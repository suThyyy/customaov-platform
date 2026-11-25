import { chromium } from 'playwright'
import assert from 'node:assert/strict'
const browser = await chromium.launch({headless:true})
try {
  for (const width of [390,768,1280,1440]) {
    const page=await browser.newPage({viewport:{width,height:1000}})
    const writes=[]
    page.on('request',r=>{if(r.url().includes('supabase.co')) writes.push(r.url())})
    await page.goto(`${process.argv[2] || 'http://localhost:5174'}/quick-team`)
    await page.getByRole('heading',{name:'Chia đội nhanh',exact:true}).waitFor()
    for(let i=1;i<=10;i++) await page.getByLabel(`Người chơi ${i}`,{exact:true}).fill(`Người ${i}`)
    for(const mode of ['random','tier','rank']) {
      await page.getByLabel('Phương pháp').selectOption(mode)
      if(mode!=='random') for(let i=1;i<=10;i++) await page.locator('main select').nth(i).selectOption(mode==='tier'?String(i%5+1):'cao-thu')
      await page.getByRole('button',{name:/^(Chia đội|Chia lại)$/}).click()
      const people=page.getByRole('region',{name:'Kết quả chia đội'}).getByRole('button',{name:/^Người/})
      assert.equal(await people.count(),10)
      await people.nth(0).click(); await people.nth(5).click(); await page.getByRole('button',{name:'Đổi chỗ',exact:true}).click()
      await page.getByText(/Đã điều chỉnh thủ công/).waitFor()
    }
    await page.getByLabel('Người chơi 1',{exact:true}).fill('Tên mới')
    assert.equal(await page.getByRole('button',{name:'Sao chép kết quả'}).isDisabled(),true)
    await page.getByRole('button',{name:'Chia lại',exact:true}).click()
    await page.getByRole('button',{name:'Sao chép kết quả'}).click()
    await page.getByRole('button',{name:'Đặt lại',exact:true}).click()
    await page.getByRole('button',{name:'Xác nhận xóa'}).click()
    assert.equal(await page.getByLabel('Người chơi 1',{exact:true}).inputValue(),'')
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
    assert.equal(writes.length,0,'Quick Team emitted Supabase requests')
    console.log(`PASS ${width}: guest random/tier/rank, swap, stale, regenerate, copy, reset, no overflow, no Supabase requests`)
    await page.close()
  }
} finally {await browser.close()}
