import test from 'node:test';
import assert from 'node:assert/strict';
import { LANGUAGES, LANGUAGE_KEY, messages, createI18n } from '../../../i18n.js';

test('every language has all messages and preserves interpolation fields', () => {
  const fields = value => [...value.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
  for (const [code] of LANGUAGES) {
    assert.deepEqual(Object.keys(messages[code]).sort(), Object.keys(messages.en).sort(), code);
    for (const [key, value] of Object.entries(messages[code])) {
      assert.ok(value.trim(), `${code}.${key}`);
      assert.deepEqual(fields(value), fields(messages.en[key]), `${code}.${key}`);
    }
  }
});
test('language preference persists without changing favourite data', () => {
  const values = new Map([['bus-o-clock.favourites.v1', 'untouched']]);
  const storage = {getItem:key => values.get(key) ?? null, setItem:(key,value) => values.set(key,value)};
  const first = createI18n({storage}); assert.equal(first.language, 'en');
  assert.equal(first.setLanguage('ko'), true);
  const reloaded = createI18n({storage}); assert.equal(reloaded.language, 'ko');
  assert.equal(reloaded.t('home'), '홈');
  assert.equal(values.get('bus-o-clock.favourites.v1'), 'untouched');
  assert.equal(reloaded.setLanguage('unsupported'), false); assert.equal(reloaded.language, 'ko');
  values.set(LANGUAGE_KEY, '__proto__'); assert.equal(createI18n({storage}).language, 'en');
});
test('blocked preference storage still supports language changes for the session', () => {
  const i18n = createI18n({storage:{getItem(){throw Error('blocked');},setItem(){throw Error('full');}}});
  assert.equal(i18n.setLanguage('ja'), false);
  assert.equal(i18n.t('leaveIn', {minutes:2,seconds:5}), 'あと2分5秒で出発');
});
test('official names use available Chinese fields and English for other languages', () => {
  const i18n = createI18n({storage:null}), names = {en:'Chuk Yuen',tc:'竹園',sc:'竹园'};
  for (const [code] of LANGUAGES) {
    i18n.setLanguage(code);
    assert.equal(i18n.officialText(names), names[code === 'zh-Hant' ? 'tc' : code === 'zh-Hans' ? 'sc' : 'en']);
    assert.equal(i18n.officialText({en:'Official English'}), 'Official English');
    assert.equal(i18n.officialText(null), '');
  }
});
test('browser language initializes first visit but never overrides saved choice',()=>{
 const storage={getItem:()=>null,setItem(){}};
 assert.equal(createI18n({storage,browserLanguages:['zh-HK','en']}).language,'zh-Hant');
 assert.equal(createI18n({storage,browserLanguages:['zh-CN']}).language,'zh-Hans');
 assert.equal(createI18n({storage,browserLanguages:['it','fr-CA']}).language,'fr');
 assert.equal(createI18n({storage:{getItem:()=> 'en'},browserLanguages:['zh-HK']}).language,'en');
});
