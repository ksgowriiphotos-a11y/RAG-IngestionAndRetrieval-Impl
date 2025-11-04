#!/usr/bin/env node
/**
 * Simple CSV -> /api/ingest uploader.
 * Usage:
 *  node scripts/csv_to_ingest.js path/to/file.csv [--url http://localhost:3001/api/ingest]
 *
 * CSV headers supported (recommended):
 * content,description,acceptanceCriteria,epic,sprint,points,priority,status,assignee,createdDate
 * - acceptanceCriteria can be a semicolon-separated list ("crit1;crit2") or JSON array string.
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    console.error('Usage: node scripts/csv_to_ingest.js <csv-file> [--url <ingest-url>]');
    process.exit(1);
  }

  const csvPath = argv[0];
  let ingestUrl = 'http://localhost:3001/api/ingest';
  const urlIndex = argv.indexOf('--url');
  if (urlIndex !== -1 && argv[urlIndex + 1]) ingestUrl = argv[urlIndex + 1];

  if (!fs.existsSync(csvPath)) {
    console.error('CSV file not found:', csvPath);
    process.exit(2);
  }

  const text = fs.readFileSync(csvPath, 'utf8');
  const records = parse(text, {
    columns: true,
    skip_empty_lines: true
  });

  const stories = records.map((r) => {
    const content = (r.content || r.story || '').trim();
    const metadata = {};

    if (r.description) metadata.description = r.description.trim();

    // acceptanceCriteria: try parse JSON, else split by ;
    if (r.acceptanceCriteria) {
      let ac = r.acceptanceCriteria.trim();
      try {
        const parsed = JSON.parse(ac);
        metadata.acceptanceCriteria = Array.isArray(parsed) ? parsed : [String(parsed)];
      } catch (e) {
        metadata.acceptanceCriteria = ac.split(';').map(s => s.trim()).filter(Boolean);
      }
    }

    if (r.epic) metadata.epic = r.epic.trim();
    if (r.sprint) metadata.sprint = r.sprint.trim();
    if (r.points) metadata.points = Number(r.points);
    if (r.priority) metadata.priority = r.priority.trim();
    if (r.status) metadata.status = r.status.trim();
    if (r.assignee) metadata.assignee = r.assignee.trim();
    if (r.createdDate) metadata.createdDate = r.createdDate.trim();

    return { content, metadata };
  }).filter(s => s.content && s.content.length > 0);

  if (stories.length === 0) {
    console.error('No valid stories parsed from CSV. Ensure you have a header named "content" and rows.');
    process.exit(3);
  }

  console.log(`Parsed ${stories.length} stories, sending to ${ingestUrl} ...`);

  // Use global fetch (Node 18+). If not available, prompt the user to install node >=18 or set up fetch.
  if (typeof fetch !== 'function') {
    console.error('\nGlobal fetch is not available in this Node.js runtime.');
    console.error('Please run on Node 18+ or install a fetch polyfill (e.g., npm i node-fetch) and re-run.');
    process.exit(4);
  }

  try {
    const resp = await fetch(ingestUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stories })
    });

    const json = await resp.json();
    if (!resp.ok) {
      console.error('Ingest API returned error:', json);
      process.exit(5);
    }

    console.log('Ingest response:', json);
    console.log('Done. Check MongoDB and the UI for inserted stories.');
  } catch (err) {
    console.error('Error calling ingest API:', err);
    process.exit(6);
  }
}

main();
