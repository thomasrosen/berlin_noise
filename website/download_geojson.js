import fetch from 'node-fetch'
import geolib from 'geolib'
import {
  polygon as turf_polygon,
  simplify as turf_simplify,
  area as turf_area,
  // bbox as turf_bbox,
  // bboxPolygon as turf_bboxPolygon,
  polygonize as turf_polygonize,
  union as turf_union,
  multiPolygon as turf_multiPolygon,
} from '@turf/turf'
import fs from 'fs'

const turf = {
  polygon: turf_polygon,
  simplify: turf_simplify,
  area: turf_area,
  // bbox: turf_bbox,
  // bboxPolygon: turf_bboxPolygon,
  polygonize: turf_polygonize,
  union: turf_union,
  multiPolygon: turf_multiPolygon,
}




function calc_area(bounds) {
  // Convert the latitude and longitude coordinates to meters using Web Mercator projection
  const topLeft = { latitude: bounds.maxlat, longitude: bounds.minlon }
  const topRight = { latitude: bounds.maxlat, longitude: bounds.maxlon }
  const bottomLeft = { latitude: bounds.minlat, longitude: bounds.minlon }

  // Calculate the distance between the top left and top right points (width)
  const width = geolib.getDistance(topLeft, topRight);

  // Calculate the distance between the top left and bottom left points (height)
  const height = geolib.getDistance(topLeft, bottomLeft);

  // Calculate the area in square meters
  const area = width * height;

  return area;
}

function get_outer (element) {
  if (element.type === 'way') {
    return turf.polygon([element.geometry.map(node => [node.lon, node.lat])])
  }

  if (element.type === 'relation') {
    let members = element.members
      .filter(member => member.role === 'outer') // only keep outer members
      .map(member => member.geometry.map(node => [node.lon, node.lat])) // convert to lon/lat pairs for geojson

    if (members.length === 0) {
      return null
    }

    // geojson to use with turf.polygonize
    const new_geojson = {
      type: 'FeatureCollection',
      features: members.map(member => ({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: member,
        },
      }))
    }

    // combine all the linestrings into one multipolygon
    const new_poly = turf.polygonize(new_geojson)

    if (new_poly.features.length === 0) {
      return null
    }

    // grab the first one
    let multipolygon = turf.polygon(new_poly.features[0].geometry.coordinates);

    // union with all the others
    for (var i = 1; i < new_poly.features.length; i++) {
      const to_be_merged_poly = turf.polygon(new_poly.features[i].geometry.coordinates);
      multipolygon = turf.union(multipolygon, to_be_merged_poly);
    }


    if (multipolygon.geometry.coordinates.length > 1) {
      return turf.polygon(multipolygon.geometry.coordinates[0]) // only keep the outer ring // TODO is this always the outer ring? Are the other rings really holes?
    }

    return turf.polygon([multipolygon.geometry.coordinates[0]]) // only keep the outer ring // TODO is this always the outer ring? Are the other rings really holes?
  }

  return outer
}

function load_geojson_from_overpass (options) {
  return new Promise((resolve, reject) => {

    const {
      overpass_query_url,
      out_filepath,
      filter_function = () => true,
      max_bbox_area_size = 30000,
      max_area_size = 40000,
      tolerance = 0.0005,
    } = options || {}

    // throw new Error('stop')

    fetch(overpass_query_url)
    .then(response => response.json())
    .then(data => {
      const elements = data.elements
        .filter(filter_function)
        .map(element => {
          const geometry = get_outer(element)

          if (geometry === null) {
            return null
          }

          delete element.nodes
          delete element.members
          delete element.geometry
          delete element.id

          return {
            ...element,
            geometry,
          }
        })
        .filter(Boolean) // remove nulls
        .filter(element => {
          // only keep ways with an area > 2000 square meters
          const bbox_area = calc_area(element.bounds)
          return bbox_area > max_bbox_area_size
        })
        .filter(element => {
          // only keep ways with an area > 2000 square meters
          // const geo_polygon = turf.polygon(element.geometry)
          const area_size = turf.area(element.geometry)

          return area_size > max_area_size
        })
        .map(element => {
          // const geo_polygon = turf.polygon(element.geometry)
          const simplified = turf.simplify(element.geometry, { tolerance, highQuality: false })

          return {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: simplified.geometry.coordinates,
            }
          }
        })

      const geojson = {
        type: 'FeatureCollection',
        features: elements,
      }

      fs.writeFileSync(out_filepath, JSON.stringify(geojson))

      resolve()
    })
    .catch(reject)

  })
}



async function load_geojson() {
  const bbox = '52.347924,12.889709,52.673884,13.745270'
  const city_and_state_bbox = '52.14444515792554,12.80731201171875,52.79445824472413,13.70819091796875'

  /*
  await load_geojson_from_overpass({
    overpass_query_url: `https://overpass-api.de/api/interpreter?data=%5Bout%3Ajson%5D%5Btimeout%3A25%5D%3B%28way%5B%22natural%22%3D%22water%22%5D%28${bbox}%29%3Brelation%5B%22natural%22%3D%22water%22%5D%28${bbox}%29%3B%29%3Bout%20geom%3B%0A`,
    out_filepath: './geojson/water.geojson',
    max_bbox_area_size: 20000,
    max_area_size: 2000,
    filter_function: (element => element.type === 'way'),
    filter_function: element => (
      element.tags?.water !== 'pond'
      && element.tags?.water !== 'reservoir'
      && element.tags?.water !== 'wastewater'
      && element.tags?.water !== 'basin'
      && element.tags?.water !== 'drain'
      && element.tags?.water !== 'ditch'
      && element.tags?.water !== 'fountain'
      && element.tags?.water !== 'lock'
      && element.tags?.amenity !== 'fountain'
      // && element.tags?.level !== '-1'
      // && element.tags?.layer !== '-1'
    ),
  })

  console.log('water.geojson done')

  await load_geojson_from_overpass({
    // [out:json][timeout:25];
    // (
    // way["landuse"~"grass|forest|farmland"]({{bbox}});
    // relation["landuse"~"grass|forest|farmland"]({{bbox}});
    //
    // way["leisure"="park"]({{bbox}});
    // relation["leisure"="park"]({{bbox}});
    //
    // way["natural"~"natural"]({{bbox}});
    // relation["natural"~"natural"]({{bbox}});
    // );
    // out geom;
    overpass_query_url: `https://overpass-api.de/api/interpreter?data=%5Bout%3Ajson%5D%5Btimeout%3A25%5D%3B%28way%5B%22landuse%22%7E%22grass%7Cforest%22%5D%28${bbox}%29%3Brelation%5B%22landuse%22%7E%22grass%7Cforest%22%5D%28${bbox}%29%3Bway%5B%22leisure%22%3D%22park%22%5D%28${bbox}%29%3Brelation%5B%22leisure%22%3D%22park%22%5D%28${bbox}%29%3Bway%5B%22natural%22%7E%22natural%22%5D%28${bbox}%29%3Brelation%5B%22natural%22%7E%22natural%22%5D%28${bbox}%29%3B%29%3Bout%20geom%3B%0A`,
    out_filepath: './geojson/grass.geojson',
    max_bbox_area_size: 40000,
    max_area_size: 40000,
    filter_function: (element => element.type === 'way'),
    // filter_function: element => (
    //   element.tags?.water !== 'pond'
    //   && element.tags?.water !== 'reservoir'
    //   && element.tags?.water !== 'wastewater'
    //   && element.tags?.water !== 'basin'
    //   && element.tags?.water !== 'drain'
    //   && element.tags?.water !== 'ditch'
    //   && element.tags?.water !== 'fountain'
    //   && element.tags?.water !== 'lock'
    //   && element.tags?.amenity !== 'fountain'
    //   // && element.tags?.level !== '-1'
    //   // && element.tags?.layer !== '-1'
    // ),
  })

  console.log('grass.geojson done')
  */
  await load_geojson_from_overpass({
    // [out:json][timeout:25][bbox:{{bbox}}]; // world
    // (
    //   way["boundary"="administrative"]["admin_level"="6"]["place"="city"];
    //   relation["boundary"="administrative"]["admin_level"="6"]["place"="city"];
    // );
    // (._;>;);
    // out geom;
    overpass_query_url: `https://overpass-api.de/api/interpreter?data=%5Bbbox%3A${city_and_state_bbox}%5D%5Bout%3Ajson%5D%5Btimeout%3A25%5D%3B%28relation%5B%22boundary%22%3D%22administrative%22%5D%5B%22admin%5Flevel%22%3D%224%22%5D%5B%22name%22%3D%22Berlin%22%5D%3B%29%3B%28%2E%5F%3B%3E%3B%29%3Bout%20geom%3B%0A`,
    out_filepath: './geojson/berlin.geojson',
    max_bbox_area_size: 40000,
    max_area_size: 40000,
    tolerance: 0.005,
    filter_function: (element => element.type === 'relation'),
  })

  console.log('berlin.geojson done')

  await load_geojson_from_overpass({
    // [out:json][timeout:25][bbox:{{bbox}}]; // world
    // (
    //   way["boundary"="administrative"]["admin_level"="6"]["place"="city"];
    //   relation["boundary"="administrative"]["admin_level"="6"]["place"="city"];
    // );
    // (._;>;);
    // out geom;
    overpass_query_url: `https://overpass-api.de/api/interpreter?data=%5Bbbox%3A${city_and_state_bbox}%5D%5Bout%3Ajson%5D%5Btimeout%3A25%5D%3B%28way%5B%22boundary%22%3D%22administrative%22%5D%5B%22admin%5Flevel%22%3D%226%22%5D%5B%22place%22%3D%22city%22%5D%3Brelation%5B%22boundary%22%3D%22administrative%22%5D%5B%22admin%5Flevel%22%3D%226%22%5D%5B%22place%22%3D%22city%22%5D%3B%29%3B%28%2E%5F%3B%3E%3B%29%3Bout%20geom%3B%0A`,
    out_filepath: './geojson/potsdam.geojson',
    max_bbox_area_size: 40000,
    max_area_size: 40000,
    tolerance: 0.0025,
    filter_function: (element => element.type === 'relation'),
  })

  console.log('potsdam.geojson done')

  return true
}

load_geojson()
  .then(() => console.log('✅ loaded geojson'))
