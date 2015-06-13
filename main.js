/**
 * Created by emery on 6/11/15.
 */

/**
 * Maps Object model
 * @param name
 * @param address
 * @param latitude
 * @param longitude
 * @constructor
 */
var MapsObject = function (name, address, latitude, longitude) {
    this.name = name;
    this.address = address;
    this.latitude = latitude;
    this.longitude = longitude;
};

var searchable = [];
var listings = [];

/**
 * onClick callbacks for Steps 1 and 4
 */
$(function()
{
    $("#submit-new").click(function()
    {
        var config = buildConfig($("#hasheaders").prop("checked"), true, main, error);

        $("#file-new").parse({
            config: config
        });

    });

    $("#submit-datasource").click(function()
    {
        var config = buildConfig(false, true, setDatasource, error);

        $("#file-datasource").parse({
            config: config
        });

    });

    $("#submit-calculate").click(run);
});

/**
 * Papaparser config object helper function
 * @param header
 * @param skipEmptyLines
 * @param complete
 * @param error
 * @returns {{header: *, skipEmptyLines: *, complete: *, error: *}}
 */
function buildConfig(header, skipEmptyLines, complete, error)
{
    return {
        header: header,
        skipEmptyLines: skipEmptyLines,
        complete: complete,
        error: error
    };
}

/**
 * Main function that is run when CSV file is parsed
 * @arguments data, errors, element
 */
function main()
{
    var errors = arguments[0].errors;

    if(errors.length > 0)
    {
        console.log("WARNING: There was an error parsing the CSV file.", errors);
    }

    var searchable = buildSearchableMapsObjects(arguments[0].data).list;

    if(searchable.length != arguments[0].data.length)
    {
        console.log("WARNING: There was an error geocoding.", errors);
    }

    createDownloadLink(searchable);

    listings = searchable.map(function(item) {
        return [item.name, item.address].join(" ");
    });

    $("#listings").autocomplete({source:listings});
}

function error(error, file)
{
    console.log("ERROR:", error, file);
}

/**
 * Creates MapObject for each row parsed from CSV file
 * @param data
 * @returns {{list: Array}}
 */
function buildSearchableMapsObjects(data)
{
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

        var address = street + ", " + city + ", " + state + ", " + zip;

        var geo = geocode(address);

        searchable[i] = new MapsObject(name, address, geo.latitude, geo.longitude);
    }

    return {
        list: searchable
    };
}

/**
 * Geocode using Google Maps API, returns latitude and longitude
 * @param address
 */
function geocode(address)
{
    var baseURL = "https://maps.googleapis.com/maps/api/geocode/json?address=";

    baseURL += address.replace(" ", "+");

    baseURL += "&key=AIzaSyDgiRKgHtGJl93ERSwzT-qzgwoYnyc3Ifo";

    $.ajax({ url: baseURL,
        async: false,
        dataType: "json",
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

/**
 * Provides download link to save datasource file
 * @param output
 */
function createDownloadLink(searchable)
{
    var file = null;
    var text = Papa.unparse(searchable);

    if (file !== null) {
        window.URL.revokeObjectURL(file);
    }

    file = window.URL.createObjectURL(new Blob(text, {type: "text/plain"}));

    $("#downloadlink").attr("href", file).show();
}

/**
 * Calculates distance between two latitude and longitude points
 * @param one
 * @param two
 * @returns {number}
 */
function getDistance(one, two)
{
    var km2miles = 0.62137;

    var lat = two[0]-one[0];
    var lng = two[1]-one[1];

    var latmiles = (110.574 * lat) * km2miles;
    var lngmiles = (111.320 * lng * Math.cos(lat)) * km2miles;

    return Math.ceil(Math.sqrt(Math.pow(latmiles,2) + Math.pow(lngmiles,2)));
}

/**
 * Support
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

    var mapid = $("#map-canvas");

    map = new google.maps.Map(mapid,
        mapOptions);

    mapid.show();

    var position;

    if($("#currentlocation").checkbox().checked())
    {
        setMapCenter("Current Location", geolocate().location);
    }
    else
    {
        var index =  listings.map(function(object, index)
        {
            if(object == $("#listings").val())
                return index;
        });

        var listing = searchable[index];

        setMapCenter(listing.name, new google.maps.LatLng(listing.latitude, listing.longitude));
    }
}

function detectBrowser()
{
    var useragent = navigator.userAgent;
    var mapdiv = document.getElementById("map-canvas");

    if (useragent.indexOf("iPhone") != -1 || useragent.indexOf("Android") != -1 ) {
        mapdiv.style.width = "100%";
        mapdiv.style.height = "100%";
    } else {
        mapdiv.style.width = "800px";
        mapdiv.style.height = "600px";
    }
}

/**
 * Geolocate using Google Map API, returns LatLng object
 */
function geolocate()
{
    if(navigator.geolocation)
    {
        navigator.geolocation.getCurrentPosition(function(position)
        {
            return {
                location: new google.maps.LatLng(position.coords.latitude, position.coords.longitude)
            };

        }, function() {
            setMapCenter("Error: The Geolocation API service failed.", false);
        });
    } else {
        setMapCenter("Error: Your browser doesn't support geolocation.", false);
    }

}

function setMapCenter(content, latlng)
{
    var position = latlng || new google.maps.LatLng(34.000791, -81.034849);

    var options = {
        map: map,
        position: position,
        content: content
    };

    var infowindow = new google.maps.InfoWindow(options);

    map.setCenter(options.position);
}

function performLookup(index, radius, variables)
{
    var lookup = variables[index];

    //return variables.filter(function(item) { return (item != lookup) && ; });

}