import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Liquid } from 'liquidjs';

const liquid = new Liquid();
liquid.registerFilter('t', (value) => value);
const rated = (id, rating, count) => ({ id, metafields: { reviews: {
  rating: { value: { rating, scale_max: 5 } }, rating_count: { value: count },
} } });
const products = [rated('lessive', 4.9, 1351), { id: 'multimaison' }, rated('savon', 4.7, 116)];

for (const name of ['cluutch-main-collection', 'cluutch-featured-collection', 'cluutch-featured-collections', 'cluutch-subscription-collection']) {
  const source = (await readFile(new URL(`../sections/${name}.liquid`, import.meta.url), 'utf8'))
    .replace(/{%-?\s*comment\s*-?%}[\s\S]*?{%-?\s*endcomment\s*-?%}/g, '');
  const assignment = source.match(/{%-?\s*liquid\s+assign rating_max = 5[\s\S]*?-?%}/)?.[0];
  // Exercise each card branch's actual visibility guard and markup, without its unrelated image/form tags.
  const badges = [...source.matchAll(/(?:{%-?\s*unless hide_rating\s*-?%}\s*)?<div\s+class="rating cluutch-rating[\s\S]*?<\/div>(?:\s*{%-?\s*endunless\s*-?%})?/g)].map(([badge]) => badge
    .replace(/{%-?\s*render [\s\S]*?-?%}/g, '★'));
  test(`${name}: every card keeps its own reviews, including after a product without reviews`, async () => {
    assert.ok(assignment, 'rating assignment found');
    assert.ok(badges.length, 'rating branches found');
    for (const badge of badges) {
      for (const sequence of [products, [...products].reverse(), [products[1], products[0]]]) {
        const html = await liquid.parseAndRender(`{% for product in products %}${assignment}<article id="{{ product.id }}">${badge}</article>{% endfor %}`, { products: sequence });
        const cards = Object.fromEntries([...html.matchAll(/<article id="([^"]+)">([\s\S]*?)<\/article>/g)].map(([, id, content]) => [id, content.trim()]));
        assert.equal(cards.multimaison, '', 'no inherited or fabricated reviews for Multi’Maison');
        assert.match(cards.lessive, /4\.9[\s\S]*\(1351\)/, 'reviews return for the next rated product');
        if (cards.savon != null) assert.match(cards.savon, /4\.7[\s\S]*\(116\)/);
      }
    }
  });
}
