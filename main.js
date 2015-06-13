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
        $("#file-new").parse({
            config: buildConfig($("#hasheaders").prop("checked"), true, main, error)
        });
    });

    $("#submit-datasource").click(function()
    {
        $("#file-datasource").parse({
            config: buildConfig(false, true, setDatasource, error)
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
    for(var index = 0; index < data.length; index++)
    {
        var obj = data[index];

        var name = obj["Company"];
        var street = obj["Business Street"];
        var city = obj["Business City"];
        var state = obj["Business State"];
        var zip = obj["Business Postal Code"];

        if(!(street && city && state && zip))
        {
            console.log("OUTPUT: Incomplete Address at Line Number: ", index ,street, city, state, zip);
        }

        var address = street + ", " + city + ", " + state + ", " + zip;

        geocode(name, address, index);
    }

    return {
        list: searchable
    };
}

/**
 * Geocode using Google Maps API, returns latitude and longitude
 * @param address
 */
function geocode(name, address, index)
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

            searchable[index] = new MapsObject(name, address, geocode.geometry.location.lat, geocode.geometry.location.lng);
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
    var json = JSON.stringify(searchable);
    var text = Papa.unparse(json);

    if (file !== null) {
        window.URL.revokeObjectURL(file);
    }

    file = window.URL.createObjectURL(new Blob([text], {type: "text/plain"}));

    $("#datasource-link").attr("href", file).show();
}

/**
 * Calculates distance between two latitude and longitude points
 * @param one
 * @param two
 * @returns {number}
 */
function determineDistance(one, two)
{
    var km2miles = 0.62137;

    var lat = two[0]-one[0];
    var lng = two[1]-one[1];

    var latmiles = (110.574 * lat) * km2miles;
    var lngmiles = (111.320 * lng * Math.cos(lat)) * km2miles;

    return Math.ceil(Math.sqrt(Math.pow(latmiles,2) + Math.pow(lngmiles,2)));
}

var map;

/**
 * Function when Go button pressed
 */
function run()
{
    detectBrowser();

    map = new google.maps.Map($("#map-canvas").show(), {
        zoom: 14,
        center: new google.maps.LatLng(34.000791, -81.034849),
        panControl: true,
        zoomControl: true,
        scaleControl: true
    });

    if($("#current-location").checkbox().checked())
    {
        setNewMarker({name:"Current Location"}, geolocate().location, true);
    }
    else
    {
        var index =  listings.map(function(object, index)
        {
            if(object == $("#listings").val())
                return index;
        });

        var object = searchable[index];

        setNewMarker(object.name, new google.maps.LatLng(object.latitude, object.longitude), false);
    }

    var print = $("#print-results").checkbox().checked();
    if (print)
        var results = $("#distance-results").show();

    performLookup().results.forEach(function(object) {
        setNewMarker(object, new google.maps.LatLng(object.latitude, object.longitude), false);

        if (print)
            results.append("<p>" + [object.name, object.distance].join(" = ") + "</p>");
    });
}

/**
 * CSS for map on web and mobile
 */
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
            setNewMarker("Error: The Geolocation API service failed.", 0, 0);
        });
    } else {
        setNewMarker("Error: Your browser doesn't support geolocation.", 0, 0);
    }
}

/**
 * Set map center with info window helper
 * @param content
 * @param latlng
 */
function setNewMarker(object, latlng, center)
{
    var infowindow = new google.maps.InfoWindow({
        content: object.name
    });

    var marker = new google.maps.Marker({
        position: latlng || new google.maps.LatLng(34.000791, -81.034849),
        map: map,
        title: object.name
    });

    google.maps.event.addListener(marker, 'click', function() {
        infowindow.open(map,marker);
    });

    if (center)
        map.setCenter(options.position);
}

/**
 * Lookup by distance by radius
 * @param location
 * @param radius
 */
function performLookup(location, radius)
{
    return {
        results: searchable.map(function (object) {
            if (determineDistance(object, location) <= radius) {
                return object;
            }
        }).sort(function (a, b) {
            if (a.distance == b.distance)
                return 0;
            else
                return a.distance > b.distance ? 1 : 0;
        })
    };
}
