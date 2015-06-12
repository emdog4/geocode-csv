/**
 * Created by emery on 6/11/15.
 */

var mapsObject = function (name, address, latitude, longitude) {
    this.name = name;
    this.address = address;
    this.latitude = latitude;
    this.longitude = longitude;
};

$(function()
{
    $('#submit-new').click(function()
    {
        var config = buildConfig($("#hasheaders").prop('checked'), true, main, error);

        $('#file-new').parse({
            config: config
        });

        $("#useexisting").prop('checked', false);

    });

    $('#submit-listings').click(function()
    {
        var config = buildConfig(false, true, buildAutocomplete, error);

        $('#file-listings').parse({
            config: config
        });

        var selector =  $("#alert-listing");
        selector.attr("class", "alert alert-success");
        selector.html("<strong>Success</strong> Listings were processed");
        selector.show();

    });

    $('#submit-datasource').click(function()
    {
        var config = buildConfig(false, true, setDatasource, error);

        $('#file-datasource').parse({
            config: config
        });

        var selector =  $("#alert-datasource");
        selector.attr("class", "alert alert-success");
        selector.html("<strong>Success</strong> Datasource was processed");
        selector.show();

    });

    $('#submit-calculate').click(function()
    {
        if(isSynced())
            run();
        else
            debug();
    });

});

function buildConfig(header, skipEmptyLines, complete, error)
{
    return {
        header: header,
        skipEmptyLines: skipEmptyLines,
        complete: complete,
        error: error
    };
}

var datasource = [];
var listings = [];

function main()
{
    var errors = arguments[0].errors;

    if(errors.length > 0)
    {
        console.log("WARNING: There was an error parsing the CSV file.", errors);
    }

    var points = compile(arguments[0].data).points;
    var searchable = compile(arguments[0].data).listings;

    if(points.length != arguments[0].data.length || points.length != searchable.length)
    {
        console.log("WARNING: There was an error geocoding.", errors);
    }

    var output = generatePointReferences(points);

    var datasourcefile = writeToDownload(output, 'datasourcelink').csvfile;
    var listingsfile = writeToDownload(searchable, 'listingslink').csvfile;

    setDatasource(datasourcefile);

    buildAutocomplete(listingsfile);
}

function error(error, file)
{
    console.log("ERROR:", error, file);
}

function compile(data)
{
    var searchable = [];

    for(var i = 0; i < data.length; i++)
    {
        var obj = data[i];

        var name = obj["Company"];
        var street = obj["Business Street"];
        var city = obj["Business City"];
        var state = obj["Business State"];
        var zip = obj["Business Postal Code"];

        if(!(street && city && state && zip))
        {
            console.log("OUTPUT: Incomplete Address at Line Number: ", i ,street, city, state, zip);
        }
        else
        {
            var address = street + ", " + city + ", " + state + ", " + zip;

            searchable[i] = name + " " + address;


        }
    }

    return {
        listings: searchable,
        points: locations
    }
}

function geocode(address)
{
    var baseURL = "https://maps.googleapis.com/maps/api/geocode/json?address=";

    baseURL += address.replace(" ", "+");

    baseURL += "&key=AIzaSyDgiRKgHtGJl93ERSwzT-qzgwoYnyc3Ifo";

    $.ajax({ url: baseURL,
        async: false,
        dataType: 'json',
        success: function(data)
        {
            var geocode = data.results[0];

            return {
                latitude: geocode.geometry.location.lat,
                longitude: geocode.geometry.location.lng
            };
        }
    });
}

function generatePointReferences(points)
{
    var deliminator = ",";

    var rows = [];

    for(var i = 0; i < points.length; i++)
    {
        var str = "";

        for(var j = 0; j < points.length; j++)
        {
            if (j > 0)
                str += deliminator;

            if(i == j)
                str += "0";
            else {
                var distance = getDistance(points[i], points[j]);
                str += distance.toString();
            }
        }

        rows[i] = str;
    }

    if(points.length > rows.length)
    {
        console.log("WARNING: There was an error generating the CSV file.");
    }

    return {
        csv: rows
    };
}

function getDistance(one, two)
{
    var km2miles = 0.62137;

    var lat = two[0]-one[0];
    var lng = two[1]-one[1];

    var latmiles = (110.574 * lat) * km2miles;
    var lngmiles = (111.320 * lng * Math.cos(lat)) * km2miles;

    return Math.ceil(Math.sqrt(Math.pow(latmiles,2) + Math.pow(lngmiles,2)));
}

function writeToDownload(output, element)
{
    var file = null;
    var text = "";

    for(var i = 0; i < output.csv.length; i++)
    {
        text += output.csv[i] + "\r\n";
    }

    var data = new Blob([text], {type: 'text/plain'});

    if (file !== null) {
        window.URL.revokeObjectURL(file);
    }

    file = window.URL.createObjectURL(data);

    var link = document.getElementById(element);
    link.href = file;
    link.style.display = 'block';

    return {
        csvfile: data
    };
}

function buildAutocomplete()
{
    listings = arguments[0].data;

    $("#listings").autocomplete({source:listings});
}

function setDatasource()
{
    datasource = arguments[0].data;
}

function isSynced()
{
    return datasource && listings;
}

function debug()
{
    if(!datasource) {
        var selector =  $("#alert-datasource");
        selector.removeClass("alert-success").addClass("alert-error");
        selector.html("<strong>Error</strong> A Listings file was not found.");
        selector.show();
    }

    if(!listings) {
        var selector =  $("#alert-listing");
        selector.removeClass("alert-success").addClass("alert-error");
        selector.html("<strong>Error</strong> A Listings file was not found.");
        selector.show();
    };

    if(!$("#currentlocation").checkbox().checked() || $("#listings").value.length == 0) {
        var selector =  $("#alert-location");
        selector.removeClass("alert-success").addClass("alert-error");
        selector.html("<strong>Error</strong> A location was not selected.");
        selector.show();
    }

    if(!$("#usemap").checkbox().checked() && !$("#printresults").checkbox().checked()) {
        var selector =  $("#alert-display");
        selector.removeClass("alert-success").addClass("alert-warning");
        selector.html("<strong>Warning</strong> No display method was selected.");
        selector.show();
    }
}

/**
 * maps
 */


var map;

function run()
{
    detectBrowser();

    var mapOptions = {
        zoom: 14,
        center: new google.maps.LatLng(34.000791, -81.034849),
        panControl: true,
        zoomControl: true,
        scaleControl: true
    }

    var mapelement = $("#map-canvas");

    map = new google.maps.Map(mapelement,
        mapOptions);

    mapelement.show();

    var position;

    if($("#currentlocation").checkbox().checked())
        position = geolocate().location;
    else


    if (position)
        addMarker(position);
}

function detectBrowser()
{
    var useragent = navigator.userAgent;
    var mapdiv = document.getElementById("map-canvas");

    if (useragent.indexOf('iPhone') != -1 || useragent.indexOf('Android') != -1 ) {
        mapdiv.style.width = '100%';
        mapdiv.style.height = '100%';
    } else {
        mapdiv.style.width = '800px';
        mapdiv.style.height = '600px';
    }
}

function addMarker(latlng)
{
    var marker = new google.maps.Marker({
        position: latlng,
        title:"Hello World!"
    });

    marker.setMap(map);
}

function geolocate()
{
    var content;

    if(navigator.geolocation)
    {
        navigator.geolocation.getCurrentPosition(function(position)
        {
            var pos = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);

            var infowindow = new google.maps.InfoWindow({
                map: map,
                position: pos,
                content: 'Location found using HTML5.'
            });

            return {
                location: pos
            };

        }, function() {
            handleNoGeolocation(true);
        });
    } else {
        handleNoGeolocation(false);
    }

}

function handleNoGeolocation(errorFlag)
{
    if (errorFlag) {
        var content = 'Error: The Geolocation API service failed.';
    } else {
        var content = 'Error: Your browser doesn\'t support geolocation.';
    }

    var options = {
        map: map,
        position: new google.maps.LatLng(60, 105),
        content: content
    };

    var infowindow = new google.maps.InfoWindow(options);

    map.setCenter(options.position);
}

function performLookup(index, radius, variables)
{
    var lookup = variables[index];

    return variables.filter(function(item) { return (item != lookup) && ; });

}