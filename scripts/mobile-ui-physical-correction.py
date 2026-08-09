from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


app_path = Path('app.html')
app = app_path.read_text()

app = replace_once(
    app,
    "input[type=text],input[type=number],input[type=search],input[type=password],select{font:inherit;font-size:16px;padding:9px 11px;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--ink);min-width:0}",
    "input[type=text],input[type=number],input[type=search],input[type=password],select{font:inherit;font-size:16px;font-size-adjust:.48;line-height:1.25;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--ink);min-width:0}",
    'ordinary form control typography')

app = replace_once(
    app,
    "label.fld{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--ink-soft);font-weight:500}",
    "label.fld{display:flex;flex-direction:column;gap:5px;font-size:12.5px;line-height:1.3;color:var(--ink-soft);font-weight:500}",
    'field label rhythm')

app = replace_once(
    app,
    "textarea{width:100%;font:inherit;font-size:16px;padding:11px;border:1px solid var(--line);border-radius:8px;resize:vertical;min-height:80px;background:#fff;color:var(--ink)}",
    "textarea{width:100%;font:inherit;font-size:16px;font-size-adjust:.48;line-height:1.25;padding:9px 10px;border:1px solid var(--line);border-radius:8px;resize:vertical;min-height:80px;background:#fff;color:var(--ink)}",
    'textarea typography')

app = replace_once(
    app,
    ".global-ask input{width:100%;min-height:48px;padding:10px 52px 10px 15px;border:1px solid rgba(255,255,255,.32);border-radius:24px;background:rgba(255,255,255,.12);color:#fff;font-size:16px;box-shadow:none}",
    ".global-ask input{width:100%;min-height:48px;padding:10px 52px 10px 15px;border:1px solid rgba(255,255,255,.32);border-radius:24px;background:rgba(255,255,255,.12);color:#fff;font-size:16px;font-size-adjust:.48;line-height:1.25;box-shadow:none}",
    'global Ask typography')

app_path.write_text(app)

test_path = Path('tests/iphone-form-focus-zoom.test.mjs')
tests = test_path.read_text()
addition = r'''

test('focus-safe controls use a smaller visual x-height without dropping the 16px declaration',()=>{
  const ordinary=ruleBody('input[type=text],input[type=number],input[type=search],input[type=password],select');
  assert.match(ordinary,/(?:^|;)font-size:16px(?:;|$)/);
  assert.match(ordinary,/(?:^|;)font-size-adjust:\.48(?:;|$)/);
  assert.doesNotMatch(ordinary,/(?:^|;)(?:zoom|transform):/);

  for(const selector of ['textarea','.global-ask input']){
    const body=ruleBody(selector);
    assert.match(body,/(?:^|;)font-size:16px(?:;|$)/);
    assert.match(body,/(?:^|;)font-size-adjust:\.48(?:;|$)/);
  }
});

test('mobile form chrome is compact while field labels retain a clear subordinate hierarchy',()=>{
  const ordinary=ruleBody('input[type=text],input[type=number],input[type=search],input[type=password],select');
  assert.match(ordinary,/(?:^|;)line-height:1\.25(?:;|$)/);
  assert.match(ordinary,/(?:^|;)padding:8px 10px(?:;|$)/);

  const label=ruleBody('label.fld');
  assert.match(label,/(?:^|;)gap:5px(?:;|$)/);
  assert.match(label,/(?:^|;)font-size:12\.5px(?:;|$)/);
  assert.match(label,/(?:^|;)line-height:1\.3(?:;|$)/);

  const textarea=ruleBody('textarea');
  assert.match(textarea,/(?:^|;)line-height:1\.25(?:;|$)/);
  assert.match(textarea,/(?:^|;)padding:9px 10px(?:;|$)/);
});
'''
if "focus-safe controls use a smaller visual x-height" in tests:
    raise SystemExit('focused typography regressions already present')
test_path.write_text(tests.rstrip() + addition)
