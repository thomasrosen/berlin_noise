import fs from 'fs'
import geojson2svg from 'geojson-to-svg'

const map_filepath_berlin = './geojson/berlin.geojson' // the path is relative to the package.json level
const map_filepath_potsdam = './geojson/potsdam.geojson' // the path is relative to the package.json level
const map_filepath_water = './geojson/water.geojson' // the path is relative to the package.json level
const map_filepath_grass = './geojson/grass.geojson' // the path is relative to the package.json level

function get_map_json(points) {
  let geojson_berlin = fs.readFileSync(map_filepath_berlin, 'utf8')
  geojson_berlin = JSON.parse(geojson_berlin)

  let geojson_potsdam = fs.readFileSync(map_filepath_potsdam, 'utf8')
  geojson_potsdam = JSON.parse(geojson_potsdam)

  let geojson_water = fs.readFileSync(map_filepath_water, 'utf8')
  geojson_water = JSON.parse(geojson_water)

  let geojson_grass = fs.readFileSync(map_filepath_grass, 'utf8')
  geojson_grass = JSON.parse(geojson_grass)

  const fills = [
    ...(
      geojson_berlin.features
        .map(feature => {
          feature.properties = {
            style: 'berlin'
          }
          return feature
        })
    ),
    ...(
      geojson_potsdam.features
        .map(feature => {
          feature.properties = {
            style: 'potsdam'
          }
          return feature
        })
    ),
    // ...(
    //   geojson_grass.features
    //     .map(feature => {
    //       feature.properties = {
    //         style: 'grass'
    //       }
    //       return feature
    //     })
    // ),
    // ...(
    //   geojson_water.features
    //     .map(feature => {
    //       feature.properties = {
    //         style: 'water'
    //       }
    //       return feature
    //     })
    // ),
  ]

  // boundaries for berlin+potsdam
  const minLat = 52.29056
  const minLng = 12.90615
  const maxLat = 52.73088
  const maxLng = 13.80193

  points = points
    .filter(point =>
      point.latitude >= minLat
      && point.latitude <= maxLat
      && point.longitude >= minLng
      && point.longitude <= maxLng
    )
    .map(point => ({
      type: 'Feature',
      properties: {
        style: 'point',
        radius: 25,
      },
      geometry: { coordinates: [point.longitude, point.latitude], type: "Point" }
    }))


  geojson_berlin.features = [
    ...fills,
    ...points,
  ]

  return geojson_berlin
}

function render_map(points) {
  const scale = 10000
  const result = geojson2svg()
    .type('style')
    .styles({
      'berlin': { fill: 'black', color: 'black', weight: 10, opacity: 1 },
      'potsdam': { fill: '#555', color: '#555', weight: 10, opacity: 1 },
      'water': { fill: '#fff', color: '#fff', weight: 0, opacity: 1 },
      'grass': { fill: '#0f0', color: '#0f0', weight: 0, opacity: 0.6 },
      'point': { fill: 'red', color: 'red', weight: 0, opacity: 1 },
    })
    .projection(function (coord) {
      const x = coord[0] * scale * 0.6 // Scale the X axis to look more like a square
      const y = coord[1] * scale * -1 // Invert the Y axis
      return [x, y]
    })
    .data(get_map_json(points))
    .render()

  // var converter = geojson2svg({});
  // console.log(converter)
  // var result = converter.convert(JSON.stringify({
  //   type: 'FeatureCollection',
  //   features: get_map_json(points),
  // }))
  // console.log(result)

  return result
}

export default render_map
