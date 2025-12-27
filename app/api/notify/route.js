import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const { type, itemName, userName, oderId } = await request.json()
    
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL
    const resendApiKey = process.env.RESEND_API_KEY
    const adminEmail = process.env.ADMIN_EMAIL || 'wacow174@gmail.com'
    
    // 時間戳
    const timestamp = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })

    // 發送 Discord Webhook
    if (webhookUrl) {
      const colors = {
        '兌換獎品': 0x00ff00,
        '福引抽獎': 0xffd700,
        '福引十連抽': 0xff69b4,
        '郵寄申請': 0x0099ff,
        '兌換碼': 0x9b59b6,
      }

      const discordPayload = {
        embeds: [{
          title: `🎉 ${type}通知`,
          color: colors[type] || 0xff6600,
          fields: [
            { name: '👤 用戶', value: userName || '未知', inline: true },
            { name: '🎁 內容', value: itemName || '未知', inline: true },
            { name: '🆔 Discord ID', value: oderId || '未知', inline: false },
          ],
          timestamp: new Date().toISOString(),
          footer: { text: '鯛魚燒商城' }
        }]
      }

      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(discordPayload)
        })
        console.log('Discord webhook sent successfully')
      } catch (webhookError) {
        console.error('Discord webhook error:', webhookError)
      }
    } else {
      console.log('DISCORD_WEBHOOK_URL not configured')
    }

    // 發送 Email（使用 Resend）
    if (resendApiKey) {
      try {
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Taiyaki Shop <onboarding@resend.dev>',
            to: [adminEmail],
            subject: `🐟 ${type}通知 - ${userName}`,
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <style>
                  body { font-family: Arial, sans-serif; background-color: #fff5eb; padding: 20px; }
                  .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; padding: 24px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                  .header { text-align: center; margin-bottom: 20px; }
                  .title { color: #ea580c; font-size: 24px; margin: 0; }
                  .info { background: #fff7ed; border-radius: 8px; padding: 16px; margin: 16px 0; }
                  .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #fed7aa; }
                  .info-row:last-child { border-bottom: none; }
                  .label { color: #9a3412; font-weight: bold; }
                  .value { color: #1f2937; }
                  .footer { text-align: center; color: #9ca3af; font-size: 12px; margin-top: 20px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1 class="title">🐟 鯛魚燒商城</h1>
                    <p style="color: #6b7280;">${type}通知</p>
                  </div>
                  <div class="info">
                    <div class="info-row">
                      <span class="label">👤 用戶</span>
                      <span class="value">${userName}</span>
                    </div>
                    <div class="info-row">
                      <span class="label">🎁 內容</span>
                      <span class="value">${itemName}</span>
                    </div>
                    <div class="info-row">
                      <span class="label">🆔 Discord ID</span>
                      <span class="value">${oderId}</span>
                    </div>
                    <div class="info-row">
                      <span class="label">🕐 時間</span>
                      <span class="value">${timestamp}</span>
                    </div>
                  </div>
                  <div class="footer">
                    <p>巫女様神社 ⛩️</p>
                  </div>
                </div>
              </body>
              </html>
            `
          })
        })
        
        const emailResult = await emailResponse.json()
        console.log('Email result:', emailResult)
        
        if (!emailResponse.ok) {
          console.error('Email send failed:', emailResult)
        }
      } catch (emailError) {
        console.error('Email error:', emailError)
      }
    } else {
      console.log('RESEND_API_KEY not configured - skipping email')
    }

    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('Notify error:', error)
    return NextResponse.json({ error: 'Notification failed' }, { status: 500 })
  }
}
