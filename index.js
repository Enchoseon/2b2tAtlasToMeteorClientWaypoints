"use strict";
// =======
// Imports
// =======

const { objectToNbt } = require("objectToNbt");
const fetch = require("node-fetch");
const CurveInterpolator = require("curve-interpolator").CurveInterpolator;

const fs = require("fs");

// ===========
// Global Vars
// ===========

var convertedLocations = []; // This array stores the names of locations as they're converted into waypoints. (Meteor client crashes if waypoints have duplicate names.)

// ==================
// Assemble Waypoints
// ==================

fetchLocations().then(locationsObj => {
    var output = {
        waypoints: [] // Array of locations that have been processed into waypoint objects
    };
    Object.values(locationsObj).forEach((location) => { // Process locations into waypoints and append the waypoint objects to output.waypoints
        const distance = Math.sqrt(Math.pow(location.x, 2) + Math.pow(location.z, 2)) / 8; // Calculate distance from 0,0 in Nether.
        if (distance > 250) { // Almost everything within 2k of spawn is completely gone
            // Create waypoint that's only visible in respective dimension
            const netherWaypoint = createWaypoint(location.name, { x: location.x, z: location.z }, distance);
            const overworldWaypoint = waypointToOverworld(netherWaypoint);
            // Push waypoints to output
            output.waypoints.push(netherWaypoint);
            output.waypoints.push(overworldWaypoint); // Last minute fix (see comment on "waypointToOverworld")
            convertedLocations.push(location.name);
            console.log(netherWaypoint);
        }
    });
    fs.createWriteStream("./connect.2b2t.org.nbt").write(objectToNbt(output));
});

// =========
// Functions
// =========

/** Fetch Overworld locations from 2b2tatlas.com */
async function fetchLocations() {
    const response = await fetch("https://2b2tatlas.com/api/locations.php?dimension=0");
    const locationsObj = await response.text();
    return JSON.parse(locationsObj);
}

/** Create an object that represents a point of interest with proper type tags for objectToNbt */
function createWaypoint(name, coords, distance) {
    // Assemble waypoint
    var waypoint = {
        name: name,
        icon: "star",
        color: calculateColor(distance),
        x: parseInt(coords.x / 8), // Convert coordinates to Nether coordinates
        y: 69,
        z: parseInt(coords.z / 8), // Convert coordinates to Nether coordinates
        visible: "1b",
        maxVisibleDistance: calculateMaxVisibleDistance(distance),
        scale: "1d",
        dimension: "Nether",
        nether: "1b",
        overworld: "0b",
        end: "0b"
    };
    // End portal-specific things
    if (name === "End Portal") {
        waypoint.icon = "triangle",
        waypoint.color = {
            r: 177,
            g: 29,
            b: 230,
            a: 99,
            rainbow: "0b"
        };
        waypoint.maxVisibleDistance = 4200;
    }
    // Add numbers to duplicate names to prevent crash because Meteor Client is shit.
    var duplicateNames = 0;
    convertedLocations.forEach((check) => {
        if (check.toLowerCase().trim() === waypoint.name.toLowerCase().trim()) {
            duplicateNames++;
        }
    });
    if (duplicateNames > 0) {
        waypoint.name += " #" + (duplicateNames + 1);
    }
    return waypoint;
}

/** Convert a waypoint from createWaypoint into something usable for the Overworld */
function waypointToOverworld(waypointObj) { // ...'kay near the end of while I was making this I found out that in-game the maxVisibleDistance stays constant in Meteor Client no matter what dimension you're on, so I'm adding this last-minute fix so that switching dimensions doesn't affect your visibility of points of interest around you.
    const convertedWaypointObj = Object.assign({}, waypointObj);
    convertedWaypointObj.name += " (OW)";
    convertedWaypointObj.maxVisibleDistance *= 8;
    convertedWaypointObj.nether = "0b";
    convertedWaypointObj.overworld = "1b";
    return convertedWaypointObj;
}

/** Calculate masVisibleDistance based on distance to 0,0 Nether (closer to spawn = smaller maxVisibleDistance, farther from spawn = higher maxVisibleDistance) */
function calculateMaxVisibleDistance(distance) {
    const alpha = Math.min(distance / 375000, 1); // Cap alpha at 1
    const interpolator = new CurveInterpolator([ // Spline points for calculating maxVisibleDistance (index 0: distance from 0,0 in Nether; index 1: max visible distance)
        [0, 196],
        [5000, 6969],
        [25000, 13420],
        [50000, 42000],
        [375000, 142069]
    ], { tension: 0.21 });
    return parseInt(interpolator.getPointAt(alpha)[1]);
}

/** Calculate color based on distance to 0,0 Nether (generates a random color and lowers the alpha of points of interest closer to spawn and vice versa) */
function calculateColor(distance) {
    var alpha = 196; // Transparency of the color (valid ranges are 0 - 255)
    // Points of interest that are closer to spawn are very common, so their alpha is lower to reduce visual clutter.
    if (distance > 50000) {
        alpha = 242;
    } else if (distance > 25000) {
        alpha = 196;
    } else if (distance > 5000) {
        alpha = 169;
    }
    // Return color object
    return {
        r: rand(),
        g: rand(),
        b: rand(),
        a: alpha,
        rainbow: "0b"
    };
    /** Generate random integer between 0 and 255 */
    function rand() {
        return Math.floor(Math.random() * 255);
    }
}