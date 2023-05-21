import geojson2svg from "geojson-to-svg"
import fs from 'fs'

const map_filepath_berlin = './berlin.geojson' // the path is relative to the package.json level
const map_filepath_potsdam = './potsdam.geojson' // the path is relative to the package.json level

function get_map_json(points) {
  let geojson_berlin = fs.readFileSync(map_filepath_berlin, 'utf8')
  geojson_berlin = JSON.parse(geojson_berlin)

  let geojson_potsdam = fs.readFileSync(map_filepath_potsdam, 'utf8')
  geojson_potsdam = JSON.parse(geojson_potsdam)

  const fills = [
    ...(
      geojson_berlin.features
      .map(feature => {
        feature.properties.style = 'berlin'
        return feature
      })
    ),
    ...(
      geojson_potsdam.features
        .map(feature => {
          feature.properties.style = 'potsdam'
          return feature
        })
    ),
  ]

  points = points
    .map(point => ({
      type: "Feature",
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

function render_map (points) {
  const scale = 10000
  const result = geojson2svg()
  .type('style')
  .styles({
    'berlin': { fill: 'black', color: 'black', weight: 10, opacity: 1 },
    'potsdam': { fill: '#555', color: '#555', weight: 10, opacity: 1 },
    'point': { fill: 'red', color: 'red', weight: 0, opacity: 1 },
  })
  .projection(function (coord) {
    const x = coord[0] * scale * 0.6 // Scale the X axis to look more like a square
    const y = coord[1] * scale * -1 // Invert the Y axis
    return [x, y]
  })
    .data(get_map_json(points))
  .render()

  return result
}

export default render_map
