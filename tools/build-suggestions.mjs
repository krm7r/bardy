import fs from 'node:fs/promises';
const seed = [
  'أخبار مصر','خدمات حكومية','جامعات مصر','السياحة في مصر','أسعار الذهب اليوم',
  'مواعيد القطارات','الطقس في القاهرة','وزارة الصحة','جامعة القاهرة',
  'وزارة الداخلية','وزارة التعليم العالي','بوابة الحكومة المصرية'
];
let discovered=[];
try {
  const data=JSON.parse(await fs.readFile('artifacts/eg-domains-results.json','utf8'));
  discovered=(data.results||[]).flatMap(x=>[x.title]).filter(x=>typeof x==='string');
} catch {}
const values=[...new Set([...seed,...discovered.map(x=>x.replace(/\s+/g,' ').trim()).filter(x=>x.length>=2)])]
  .sort((a,b)=>a.localeCompare(b,'ar')).slice(0,5000);
await fs.writeFile('suggestions.json',JSON.stringify(values,null,2)+'\n');
console.log(`Wrote ${values.length} suggestions`);
