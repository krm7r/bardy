import fs from "node:fs";
import assert from "node:assert/strict";

const appPath = new URL("../taxonomy/search-taxonomy.json", import.meta.url);
const crawlerPath = process.env.CRAWLER_TAXONOMY_PATH
  ? new URL(`file://${process.env.CRAWLER_TAXONOMY_PATH}`)
  : new URL("../../baheth-masr-crawler/taxonomy/search-taxonomy.json", import.meta.url);
const app = JSON.parse(fs.readFileSync(appPath, "utf8"));
const crawlerExists = fs.existsSync(crawlerPath);
const crawler = crawlerExists ? JSON.parse(fs.readFileSync(crawlerPath, "utf8")) : null;

function validateTaxonomy(taxonomy, label) {
  assert.match(taxonomy.version, /^\d+\.\d+\.\d+$/);
  assert.ok(Array.isArray(taxonomy.categories) && taxonomy.categories.length >= 10, `${label}: categories are incomplete`);
  const categoryIds = new Set();
  const subcategoryIds = new Set();
  for (const category of taxonomy.categories) {
    assert.match(category.id, /^[a-z][a-z0-9_]*$/, `${label}: invalid category id`);
    assert.ok(!categoryIds.has(category.id), `${label}: duplicate category ${category.id}`);
    categoryIds.add(category.id);
    assert.equal(typeof category.name_ar, "string");
    assert.ok(Array.isArray(category.keywords_ar));
    assert.ok(Array.isArray(category.subcategories));
    for (const subcategory of category.subcategories) {
      assert.match(subcategory.id, /^[a-z][a-z0-9_]*$/, `${label}: invalid subcategory id`);
      assert.ok(!subcategoryIds.has(subcategory.id), `${label}: duplicate subcategory ${subcategory.id}`);
      subcategoryIds.add(subcategory.id);
      assert.ok(!categoryIds.has(subcategory.id), `${label}: subcategory collides with category`);
      assert.ok(Array.isArray(subcategory.keywords_ar));
    }
  }
  assert.ok(categoryIds.has(taxonomy.default_category), `${label}: invalid default category`);
  assert.equal(taxonomy.classification_policy.max_primary_categories, 1);
  assert.equal(taxonomy.classification_policy.manual_review_required_for_approved, true);
  return {categories: categoryIds.size, subcategories: subcategoryIds.size};
}

const appSummary = validateTaxonomy(app, "app");
let crawlerSummary = null;
if (crawler) {
  crawlerSummary = validateTaxonomy(crawler, "crawler");
  assert.equal(app.version, crawler.version);
  assert.deepEqual(
    app.categories.map(({id, name_ar, name_en, keywords_ar, subcategories}) => ({id, name_ar, name_en, keywords_ar, subcategories})),
    crawler.categories.map(({id, name_ar, name_en, keywords_ar, subcategories}) => ({id, name_ar, name_en, keywords_ar, subcategories})),
    "crawler taxonomy must match the app taxonomy",
  );
}
console.log(JSON.stringify({ok: true, version: app.version, app: appSummary, crawler: crawlerSummary, crawlerComparison: Boolean(crawler)}, null, 2));
