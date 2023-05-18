import fs from 'fs'
import YAML from 'yaml'

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

  const data = load_metadata_from_files()

  const amount_of_recordings = data.length

  const what_tags = [...new Set(data.flatMap(item => item.what))]
    .sort((a, b) => a.localeCompare(b))

  const sum_length_of_all_recordings = data
    .reduce((acc, item) => acc + item.length, 0)

  const what_tags_metadata = what_tags
  .map((tag) => {
    const items_with_tag = data.filter((item) => item.what.includes(tag))

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
    .sort((a, b) => b.amount - a.amount)

  // length of the recording in seconds and minutes
  const hours = Math.floor(sum_length_of_all_recordings / 60 / 60)
  const minutes = Math.floor(sum_length_of_all_recordings / 60) - hours * 60
  const seconds = (sum_length_of_all_recordings % 60).toFixed(2)
  const length_of_recordings_as_text = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0') } (${sum_length_of_all_recordings} seconds)`

  const html = `
    <p><strong>Amount of recordings</strong>: ${amount_of_recordings}</p>
    <p><strong>Sum length of all recordings</strong>: ${length_of_recordings_as_text}</p>

    <h3>Whats in the dataset?</h3>
    <p>
      Each entry has some tags. Here is an overview of these tags. In each row: the tag and how much of the dataset is tagged with it.
    </p>
    <ul class="tag_cloud">
      ${what_tags_metadata.map((item) => `
        <li title="${item.tag}: ${item.amount} recordings and ${item.length_sum_percent}%">
          <strong>${item.tag}</strong> ${item.amount}
        </li>
      `).join('')}
    </ul>
  `

  console.info('✅ HTML generated')

  save_new_index_html(html)
}

create_metadata_html()
