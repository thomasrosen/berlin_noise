import fs from 'fs'
import YAML from 'yaml'

import render_map from './render_map.js'

function get_hours_graph(all_metadata) {

  const all_hours = all_metadata
    .reduce((acc, item) => {
      const this_date = new Date(item.timestamp)
      const hours = this_date.getHours()

      if (!acc[hours]) {
        acc[hours] = 0
      }
      acc[hours] += 1

      return acc
    }, {})

  const max_per_hour = Math.max(...Object.values(all_hours))

  const hours = new Array(24).fill(0)
    .reduce((acc, _, index) => {
      const hour = String(index).padStart(2, '0') // 00, 01, 02, ...
      const amount = all_hours[index] || 0 // get the amount of recordings for this hour or 0 if there is no property in all_hours
      acc.push({
        hour,
        amount,
        percent: amount / max_per_hour, // normalize the amount of recordings for this hour to a value between 0 and 1
      })

      return acc
    }, [])
    .sort((a, b) => a.hour.localeCompare(b.hour))

  return hours
}

function render_hours_graph(all_metadata) {
  const hours = get_hours_graph(all_metadata)
  const html = `
    <h3>Recordings per hour of day</h3>
    <p>The graph shows the amount of recordings per hour of day.</p>
    <div class="hours_graph">
      ${hours.map((hour) => `
        <div class="hours_graph__bar" style="height: ${hour.percent * 100}%" title="${hour.amount} recordings at ${hour.hour}h">
          <div class="hours_graph__bar__hour">${hour.hour}</div>
          <div class="hours_graph__bar__amount">${hour.amount ? hour.amount : ''}</div>
        </div>
      `).join('')}
    </div>
  `
  return html
}

function getsec(time) {
  const arr = time.split(':');
  return (+arr[0]) * 3600 + (+arr[1]) * 60 + (+arr[2]);
}

function load_metadata_from_files() {
  const files = fs.readdirSync('../metadata')

  const metadata_files = files
    .filter((file) => file.endsWith('.yml'))
    .map((file) => {
      try {
        const file_content = fs.readFileSync(`../metadata/${file}`, 'utf8')
        const { metadata } = YAML.parse(file_content)
        metadata.what = (metadata?.what || '').split(',').map((w) => w.trim())
        metadata.length = getsec('00:' + metadata?.length)
        return metadata
      } catch (e) {
        return null
      }
    })
    .filter(Boolean)

  console.info('✅ loaded metadata.yml')

  return metadata_files
}

function save_new_index_html(recording_metadata_html) {

  let template_html = fs.readFileSync('./template.html', 'utf8')

  const current_year = new Date().getFullYear()
  template_html = template_html.replace('<!--current_year-->', current_year)

  template_html = template_html.replace('<!--recording_metadata-->', recording_metadata_html)

  // check if build folder exists
  if (!fs.existsSync('../build')) {
    fs.mkdirSync('../build')
  }

  fs.writeFileSync('../build/index.html', template_html)

  console.info('✅ new index.html saved')
}

function create_metadata_html() {
  console.info('✅ started build.js')

  const all_metadata = load_metadata_from_files()

  const points = all_metadata.map((item) => ({
    latitude: item.geolocation.latitude,
    longitude: item.geolocation.longitude,
  }))

  const amount_of_recordings = all_metadata.length

  const what_tags = [...new Set(all_metadata.flatMap(item => item.what))]
    .sort((a, b) => a.localeCompare(b))

  const sum_length_of_all_recordings = all_metadata
    .reduce((acc, item) => acc + item.length, 0)

  const what_tags_metadata = what_tags
  .map((tag) => {
    const items_with_tag = all_metadata.filter((item) => item.what.includes(tag))

    const amount_of_recordings_with_tag = items_with_tag.length

    const length_sum_percent = Math.round(
      (
        items_with_tag
        .reduce((acc, item) => acc + item.length, 0)
      ) / sum_length_of_all_recordings * 100
    )

    return {
      tag,
      length_sum_percent,
      amount: amount_of_recordings_with_tag,
    }
  })
    .filter((item) => item.amount > 1)
    .sort((a, b) => b.amount - a.amount)

  // length of the recording in seconds and minutes
  const hours = Math.floor(sum_length_of_all_recordings / 60 / 60)
  const minutes = Math.floor(sum_length_of_all_recordings / 60) - hours * 60
  const seconds = (sum_length_of_all_recordings % 60).toFixed(2)
  const length_of_recordings_as_text = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0') } (${sum_length_of_all_recordings} seconds)`

  const svg_map = render_map(points)
  const hours_graph = render_hours_graph(all_metadata)

  const html = `
    <p><strong>Amount of recordings</strong>: ${amount_of_recordings}</p>
    <p><strong>Sum length of all recordings</strong>: ${length_of_recordings_as_text}</p>

    <h3>Whats in the dataset?</h3>
    <p>
      Each entry has some tags. Here is an overview of these tags. In each row: the tag and how much of the dataset is tagged with it. Only tags with more than one recording are shown.
    </p>
    <ul class="tag_cloud">
      ${what_tags_metadata.map((item) => `
        <li title="${item.tag}: ${item.amount} ${item.amount === 1 ? 'recording' : 'recordings'} and ${item.length_sum_percent}%">
          <strong>${item.tag}</strong> ${item.amount}
        </li>
      `).join('')}
    </ul>
    <h3>Map of the recordings</h3>
    <p>
      Red = Recording / Black = Berlin / Grey = Potsdam
    </p>
    ${svg_map}
    ${hours_graph}
  `

  console.info('✅ HTML generated')

  save_new_index_html(html)
}

create_metadata_html()
