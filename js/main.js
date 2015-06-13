/**
 * Maps Object model
 * @param name
 * @param address
 * @param lat
 * @param lng
 * @constructor
 */
var MapsObject = function (name, address, lat, lng) {
    this.name = name;
    this.address = address;
    this.lat = lat;
    this.lng = lng;
};

var searchable = [];
var listings = [];
var isNew = false;
var fieldsets;
var distances;
var markersArray = [];
var out;

$(function()
{
    fieldsets = $("fieldset");
    out = $("#distance-results");
    var dd = $("#directions-div");
    var radiusLookup = {25:10, 50:9, 100:8, 200:7, 500:6};

    var lookup;

    $("#submit-new").click(function()
    {
        isNew = true;

        $("#file-new").parse({
            config: buildConfig(true, true, main, error)
        });
    });

    $("#submit-datasource").click(function()
    {
        $("#file-datasource").parse({
            config: buildConfig(true, true, main, error)
        });
    });

    $("#submit-location").click(function()
    {
        $(fieldsets[0]).children().prop('disabled',true);
        $(out).empty();

        var success = false;

        if($("#current-location").prop("checked"))
        {
            var object = geolocate();

            success = (object !== undefined);

            if (success)
                lookup = new MapsObject("Current Location", "", object.lat, object.lng);
            else
                logger("Geolocation failed. Please check your browser settings or select an address.");
        }
        else
        {
            var index = listings.map(function(object, index)
            {
                if(object == $("#autocomplete-listings").val())
                    return index;
            }).filter(isFinite);

            success = (index !== undefined && index >= 0 );

            if (success)
                lookup = searchable[index];
            else
                logger("We could not find the business name you entered. Please select a value from the dropdown menu.");
        }

        if (success)
            $(fieldsets[2]).fadeIn("slow");
        else
            logger("Please try again.")
    });

    $("#submit-calculate").click(function()
    {
        $(out).empty();

        $(fieldsets[1]).children().prop('disabled',true);
        $(fieldsets[1]).find("input:text").prop('disabled',true);

        var selects = $(dd).find("select");
        var radius = $("#lookup-radius").val();

        detectBrowser();

        map = new google.maps.Map(document.getElementById("map-canvas"), {
            zoom: radiusLookup[radius],
            panControl: true,
            zoomControl: true,
            scaleControl: true
        });

        setNewMarker(lookup, true);

        directionsDisplay = new google.maps.DirectionsRenderer();
        directionsDisplay.setMap(map);

        distances = performDistanceLookup(lookup, radius).results;

        for (var i = 0; i < distances.length; i++)
        {
            var mapsObject = distances[i];
            setNewMarker(mapsObject, false);

            var option = document.createElement("option");
            option.appendChild(document.createTextNode(mapsObject.name));
            option.setAttribute("value", i.toString());

            $(selects).append(option);
            //logger([mapsObject.name, mapsObject.distance].join(" = ") + " miles");
        }

        $(dd).fadeIn("slow");

        $(fieldsets[2]).children().prop('disabled',true);
    });

    $("#submit-reset").click(function()
    {
        $(dd).find("select").empty();
        $(out).empty();

        $(fieldsets[2]).find("select").val("25");

        var input = $(fieldsets[1]).find("input:text");
        input.val("");
        input.prop("disabled",false);

        $(fieldsets[1]).find("input:checkbox").removeAttr("checked");

        $(fieldsets[1]).children().prop("disabled",false);
        $(fieldsets[2]).children().prop("disabled",false);

        clearOverlays();

        document.getElementById("map-canvas").remove();

        var newDiv = document.createElement("div");
        newDiv.setAttribute("id", "map-canvas");
        var dirDiv = document.getElementById("directions-div");

        lookup = null;
        distances = [];

        $(dd).fadeOut();
        $(fieldsets[2]).fadeOut();

        dirDiv.parentNode.insertBefore(newDiv, dirDiv.nextSibling);
    });
});

/**
 * Logger helper function
 * @param string
 */
function logger(string)
{
    out.append("<p>" + string + "</p>");
}

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

    if (isNew)
        createDownloadLink(searchable);
    else
        $("#upload-success").show();

    listings = searchable.map(function(item) {
        return [item.name, item.address].join(" ");
    });

    $("#autocomplete-listings").autocomplete({source:listings});

    $(fieldsets[1]).fadeIn("slow");
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

        if (isNew)
        {
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
        else
        {
            var name = obj["name"];
            var address = obj["address"];
            var lat = obj["lat"];
            var lng = obj["lng"];

            searchable[index] = new MapsObject(name, address, parseFloat(lat), parseFloat(lng));
        }
    }

    return {
        list: searchable
    };
}

/**
 * Geocode using Google Maps API, returns lat and lng
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

            searchable[index] = new MapsObject(name, address, parseFloat(geocode.geometry.location.lat), parseFloat(geocode.geometry.location.lng));
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
    var text = Papa.unparse(JSON.stringify(searchable));

    if (file !== null) {
        window.URL.revokeObjectURL(file);
    }

    file = window.URL.createObjectURL(new Blob([text], {type: "text/plain"}));

    $("#datasource-link").attr("href", file).show();
}

var directionsDisplay;
var directionsService = new google.maps.DirectionsService();
var map;

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
                location: lngLat({lat:position.coords.latitude, lng:position.coords.longitude})
            };

        }, function() {
            setNewMarker({name:"Error: The Geolocation API service failed."}, false);
        });
    } else {
        setNewMarker({name:"Error: Your browser doesn't support geolocation."}, false);
    }
}

/**
 * Set map center with info window helper
 * @param content
 * @param latlng
 */
function setNewMarker(object, center)
{
    var infowindow = new google.maps.InfoWindow({
        content: object.name || ""
    });

    var marker = new google.maps.Marker({
        position: lngLat(object),
        map: map,
        title: object.name
    });

    markersArray.push(marker);

    google.maps.event.addListener(marker, 'click', function() {
        infowindow.open(map, marker);
    });

    if (center)
        map.setCenter(lngLat(object));
}

/**
 * Lookup by distance by radius
 * @param location
 * @param radius
 */
function performDistanceLookup(location, radius)
{
    var alldist = searchable.map(function (object) {
        var distance = determineDistance(location, object).distance;
        if (distance <= radius) {
            object.distance = distance;
            return object;
        }
    });

    var sortdist = alldist.sort(function (a, b) {
        if (a.distance == b.distance)
            return 0;
        else
            return a.distance > b.distance ? 1 : 0;
    }).filter(function(item) { return item !== undefined});

    return {
        results: sortdist
    };
}

/**
 * Calculates distance between two lat and lng points
 * @param location
 * @param object
 * @returns {{distance: number}}
 */
function determineDistance(location, object)
{
    var km2miles = 0.62137;

    var x1lat = abs(location.lat), x1lng = abs(location.lng);
    var x2lat = abs(object.lat), x2lng = abs(object.lng);

    var lat = abs(x2lat - x1lat), lng = abs(x2lng - x1lng);

    var latmiles = (110.574 * lat) * km2miles;
    var lngmiles = (111.320 * lng * Math.cos(lat)) * km2miles;

    return {
        distance: Math.ceil(Math.sqrt(Math.pow(latmiles, 2) + Math.pow(lngmiles, 2)))
    }
}

/**
 * Abs helper
 * @param number
 * @returns {number}
 */
function abs(number)
{
    return Math.abs(number);
}

/**
 * LngLat helper
 * @param object
 * @returns {*}
 */
function lngLat(object)
{
    return (object.lat && object.lng) ?
        {lat:object.lat, lng:object.lng} : {lat:34.000791, lng:-81.034849};
}

/**
 * Calculate directions using Google Maps API
 */
function calculateRoute()
{
    var start = distances[$("#directions-start").val()];
    var end = distances[$("#directions-end").val()];

    var origin = new google.maps.LatLng(start.lat, start.lng);
    var destination = new google.maps.LatLng(end.lat, end.lng);

    var request = {
        origin: origin,
        destination:destination,
        travelMode: google.maps.TravelMode.DRIVING
    };

    directionsService.route(request, function(response, status)
    {
        if (status == google.maps.DirectionsStatus.OK) {
            directionsDisplay.setDirections(response);
        }
    });
}

/**
 * Clear markers from map
 */
function clearOverlays()
{
    for (var i = 0; i < markersArray.length; i++ )
    {
        markersArray[i].setMap(null);
    }
    markersArray.length = 0;
}