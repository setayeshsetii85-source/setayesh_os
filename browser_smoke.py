"""Optional Chromium CDP smoke: launch a fresh Chromium on port 9222 and app on 8080.
Requires Python requests and websocket-client. Creates records only in the test browser.
"""
import json, itertools, time
import requests, websocket

base='http://127.0.0.1:8080/'
target=requests.get('http://127.0.0.1:9222/json/list').json()[0]
ws=websocket.create_connection(target['webSocketDebuggerUrl'],suppress_origin=True,timeout=12)
ids=itertools.count(1)
def cdp(method, **params):
    n=next(ids); ws.send(json.dumps({'id':n,'method':method,'params':params}))
    while True:
        x=json.loads(ws.recv())
        if x.get('id')==n:
            if 'error' in x: raise AssertionError(x['error'])
            return x.get('result',{})
def js(expression):
    r=cdp('Runtime.evaluate',expression=expression,awaitPromise=True,returnByValue=True)
    if 'exceptionDetails' in r: raise AssertionError(r['exceptionDetails'])
    return r['result'].get('value')
def wait(expr):
    for i in range(50):
        if js(expr): return
        time.sleep(.12)
    raise AssertionError(expr+'\n'+str(js('document.body.innerText.slice(0,900)')))
def page(p):
    js(f"location.hash='{p}'")
    wait(f"document.querySelector('nav a[aria-current]').getAttribute('href') === '#{p}'")
cdp('Page.enable'); cdp('Network.enable'); cdp('Emulation.setDeviceMetricsOverride',width=390,height=844,deviceScaleFactor=1,mobile=True)
cdp('Storage.clearDataForOrigin',origin=base.rstrip('/'),storageTypes='all')
cdp('Page.navigate',url=base); wait('!!document.querySelector(".hero")')
wait('!!navigator.serviceWorker.controller')
assert js('document.documentElement.scrollWidth===390')
js('document.querySelector("[data-id=study][data-action=new]").click()')
js('''let f=document.querySelector('#editor');f.minutes.value=45; f.tests.value=10; f.correct.value=7; f.wrong.value=1; f.blank.value=1; f.requestSubmit()''')
wait('document.querySelector("#editor .err").textContent.includes("مجموع")')
js("f.blank.value=2;f.requestSubmit()")
wait('!document.querySelector("dialog").open && document.body.innerText.includes("۴۵ دقیقه")')
page('study');wait('document.querySelector(".list").innerText.includes("۱۰ تست")')
js('document.querySelector("[data-action=edit]").click();document.querySelector("#editor [name=minutes]").value=50;document.querySelector("#editor").requestSubmit()')
wait('!document.querySelector("dialog").open && document.body.innerText.includes("۵۰ دقیقه")')
page('reports'); wait('document.body.innerText.includes("۵۰ دقیقه")')
page('settings'); wait('document.querySelector("#push-state").innerText.includes("پیکربندی نشده")')
page('projects'); js('document.querySelector("[data-action=new]").click()');js('document.querySelector("#editor [name=title]").value="آزمون سفارش";document.querySelector("#editor").requestSubmit()');wait('document.querySelector(".list").innerText.includes("آزمون سفارش")')
page('time'); js('document.querySelector("[data-action=new][data-id=activity]").click()')
js('''{const a=document.querySelector('#editor'); a.title.value='آزمون زمان'; a.start.value='08:00'; a.end.value='08:40'; a.requestSubmit()}''')
wait('document.querySelector(".list").innerText.includes("آزمون زمان") && document.body.innerText.includes("۴۰ دقیقه")')
js('document.querySelector("[data-action=timerStart]").click();document.querySelector("#timer-form [name=title]").value="تایمر آزمایشی";document.querySelector("#timer-form").requestSubmit()')
wait('!!document.querySelector("#running-timer")'); cdp('Page.reload'); wait('document.body.innerText.includes("تایمر آزمایشی")')
page('calendar'); wait('document.querySelectorAll(".monthgrid button").length >= 29'); js('document.querySelector("[data-action=new][data-id=event]").click()')
js('''{const a=document.querySelector('#editor'); a.title.value='جلسه آزمایشی'; a.start.value='10:00'; a.end.value='10:20'; a.requestSubmit()}''')
wait('document.querySelector(".list").innerText.includes("جلسه آزمایشی")')
page('finance'); js('document.querySelector("[data-action=new][data-id=cash]").click()')
js('''{const a=document.querySelector('#editor'); a.title.value='خرید آزمایشی'; a.amount.value='12000'; a.requestSubmit()}''')
wait('document.querySelector(".metrics").innerText.includes("۱۲٬۰۰۰")')
page('home'); js('document.querySelector("[data-action=water]").click()');wait('document.body.innerText.includes("۱ از ۸ لیوان")')
js('document.querySelector("[data-action=cards]").click(); document.querySelector("[data-action=cardToggle][data-id=cash]").click(); document.querySelector("[data-action=cardsSave]").click()')
wait('!document.querySelector("dialog").open && !Array.from(document.querySelectorAll("h2")).some(e=>e.textContent==="درآمد و هزینه")')
page('settings'); js('document.querySelector("[name=theme]").value="dark"; document.querySelector("#settings-form").requestSubmit()'); wait('document.documentElement.dataset.theme==="dark"')
page('plan');js('document.querySelector("[data-action=toggle]").click()');wait('!!document.querySelector(".item.done")')
cdp('Network.emulateNetworkConditions',offline=True,latency=0,downloadThroughput=0,uploadThroughput=0)
cdp('Page.reload');wait('!!document.querySelector(".item.done")');page('study');wait('document.querySelector(".list").innerText.includes("۵۰ دقیقه")')
page('time'); wait('document.body.innerText.includes("آزمون زمان") && document.body.innerText.includes("تایمر آزمایشی")')
print('Chromium mobile: study/CRM/time/calendar/finance/water, theme and card preferences, timer persistence, offline reload: PASS')
