import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const { type, itemName, userName, oderId } = await request.json()
    
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL
    
    if (!webhookUrl) {
      console.error('DISCORD_WEBHOOK_URL not set')
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
    }

    // 根據類型設定顏色
    const colors = {
      '兌換獎品': 0x00ff00,    // 綠色
      '福引抽獎': 0xffd700,    // 金色
      '福引十連抽': 0xff69b4,  // 粉紅色
      '郵寄申請': 0x0099ff,    // 藍色
    }

    // 發送 Discord Webhook
    const discordPayload = {
      embeds: [{
        title: `🎉 ${type}通知`,
        color: colors[type] || 0xff6600,
        fields: [
          { name: '👤 用戶', value: userName, inline: true },
          { name: '🎁 獎品', value: itemName, inline: true },
          { name: '🆔 Discord ID', value: oderId, inline: false },
        ],
        timestamp: new Date().toISOString(),
        footer: { text: '鯛魚燒商城' }
      }]
    }

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(discordPayload)
    })

    // 發送 Email（使用 Resend）
    const resendApiKey = process.env.RESEND_API_KEY
    const adminEmail = process.env.ADMIN_EMAIL

    if (resendApiKey && adminEmail) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Taiyaki Shop <onboarding@resend.dev>',
            to: adminEmail,
            subject: `🎉 ${type}通知 - ${userName}`,
            html: `
              <h2>🐟 鯛魚燒商城通知</h2>
              <p><strong>類型：</strong>${type}</p>
              <p><strong>用戶：</strong>${userName}</p>
              <p><strong>獎品：</strong>${itemName}</p>
              <p><strong>Discord ID：</strong>${oderId}</p>
              <p><strong>時間：</strong>${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</p>
            `
          })
        })
      } catch (emailError) {
        console.error('Email error:', emailError)
      }
    }

    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('Notify error:', error)
    return NextResponse.json({ error: 'Notification failed' }, { status: 500 })
  }
}
