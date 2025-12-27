'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

const ADMIN_ID = '592515542208872555'
const CONVENIENCE_STORE_LINK = 'https://myship.7-11.com.tw/general/detail/GM2409203695467'

export default function Home() {
  const [user, setUser] = useState(null)
  const [dbUser, setDbUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState({ text: '', type: '' })
  const [activeTab, setActiveTab] = useState('rewards')
  const [rewards, setRewards] = useState([])
  const [prizes, setPrizes] = useState([])
  const [hasWonPrize, setHasWonPrize] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawResult, setDrawResult] = useState(null)
  const [drawResults, setDrawResults] = useState([])
  const [shippingForm, setShippingForm] = useState({
    recipientName: '', phone: '', address: '', itemName: '', notes: ''
  })
  const [redeemCode, setRedeemCode] = useState('')
  const [isRedeeming, setIsRedeeming] = useState(false)

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const userParam = urlParams.get('user')
    const errorParam = urlParams.get('error')

    if (errorParam) {
      setError(decodeURIComponent(errorParam))
      setLoading(false)
      window.history.replaceState({}, '', '/')
      return
    }

    if (userParam) {
      try {
        const userData = JSON.parse(decodeURIComponent(userParam))
        setUser(userData)
        localStorage.setItem('discord_user', JSON.stringify(userData))
        window.history.replaceState({}, '', '/')
        loadDbUser(userData.id)
      } catch (e) {
        console.error('Parse user error:', e)
      }
    } else {
      const savedUser = localStorage.getItem('discord_user')
      if (savedUser) {
        try {
          const userData = JSON.parse(savedUser)
          setUser(userData)
          loadDbUser(userData.id)
        } catch (e) {
          localStorage.removeItem('discord_user')
        }
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (supabase && user) {
      loadRewards()
      loadPrizes()
      checkWinHistory(user.id)
    }
  }, [user])

  const loadDbUser = async (discordId) => {
    if (!supabase) return
    const { data } = await supabase.from('users').select('*').eq('discord_id', discordId).single()
    setDbUser(data ? data : { points: 0, notFound: true })
  }

  const loadRewards = async () => {
    const { data } = await supabase.from('rewards').select('*').gt('quantity', 0).order('cost', { ascending: true })
    if (data) setRewards(data)
  }

  const loadPrizes = async () => {
    const { data } = await supabase.from('prizes').select('*').gt('quantity', 0)
    if (data) setPrizes(data)
  }

  const checkWinHistory = async (discordId) => {
    const { data: redemptions } = await supabase.from('redemption_orders').select('id').eq('discord_id', discordId).limit(1)
    const { data: draws } = await supabase.from('draw_records').select('id, prize_won').eq('discord_id', discordId).not('prize_won', 'ilike', '%銘謝惠顧%').limit(1)
    setHasWonPrize((redemptions && redemptions.length > 0) || (draws && draws.length > 0))
  }

  const handleLogout = () => {
    setUser(null)
    setDbUser(null)
    localStorage.removeItem('discord_user')
  }

  const handleLogin = () => {
    window.location.href = '/api/auth/login'
  }

  const refreshPoints = async () => {
    if (user) await loadDbUser(user.id)
  }

  const handleRedeem = async (reward) => {
    if (!user || !dbUser || dbUser.points < reward.cost) {
      setMessage({ text: `鯛魚燒不夠！需要 ${reward.cost} 個`, type: 'error' })
      return
    }
    try {
      await supabase.from('users').update({ points: dbUser.points - reward.cost }).eq('discord_id', user.id)
      await supabase.from('rewards').update({ quantity: reward.quantity - 1 }).eq('id', reward.id)
      await supabase.from('redemption_orders').insert({ discord_id: user.id, item_type: 'reward', item_name: reward.name, points_spent: reward.cost, delivery_method: 'convenience_store' })
      await supabase.from('win_notifications').insert({ discord_id: user.id, discord_name: user.displayName, item_type: 'reward', item_name: reward.name })
      setDbUser({ ...dbUser, points: dbUser.points - reward.cost })
      setHasWonPrize(true)
      setMessage({ text: `🎉 成功兌換「${reward.name}」！請到賣貨便下單付運費`, type: 'success', link: CONVENIENCE_STORE_LINK })
      loadRewards()
      sendWebhookNotification('兌換獎品', reward.name, user.displayName, user.id)
    } catch (err) {
      setMessage({ text: '兌換失敗，請稍後再試', type: 'error' })
    }
  }

  const handleSingleDraw = async () => {
    if (!user || !dbUser || dbUser.points < 3) {
      setMessage({ text: '鯛魚燒不夠！需要 3 個', type: 'error' })
      return
    }
    setIsDrawing(true)
    setDrawResult(null)
    setDrawResults([])

    const newPoints = dbUser.points - 3
    await supabase.from('users').update({ points: newPoints }).eq('discord_id', user.id)
    setDbUser({ ...dbUser, points: newPoints })

    setTimeout(async () => {
      const result = await performDraw()
      setDrawResult(result)
      setIsDrawing(false)
      await supabase.from('draw_records').insert({ discord_id: user.id, draws: 1, prize_won: result.name })
      if (result.isWin) {
        setHasWonPrize(true)
        setMessage({ text: `🎊 恭喜抽中「${result.name}」！請到賣貨便下單付運費`, type: 'success', link: CONVENIENCE_STORE_LINK })
        await supabase.from('win_notifications').insert({ discord_id: user.id, discord_name: user.displayName, item_type: 'gacha', item_name: result.name })
        sendWebhookNotification('福引抽獎', result.name, user.displayName, user.id)
      }
      loadPrizes()
    }, 2000)
  }

  const handleMultiDraw = async () => {
    if (!user || !dbUser || dbUser.points < 30) {
      setMessage({ text: '鯛魚燒不夠！需要 30 個', type: 'error' })
      return
    }
    setIsDrawing(true)
    setDrawResult(null)
    setDrawResults([])

    const newPoints = dbUser.points - 30 + 3
    await supabase.from('users').update({ points: newPoints }).eq('discord_id', user.id)
    setDbUser({ ...dbUser, points: newPoints })

    setTimeout(async () => {
      const results = []
      for (let i = 0; i < 10; i++) {
        const result = await performDraw()
        results.push(result)
        await supabase.from('draw_records').insert({ discord_id: user.id, draws: 1, prize_won: result.name })
      }
      setDrawResults(results)
      setIsDrawing(false)

      const wins = results.filter(r => r.isWin)
      if (wins.length > 0) {
        setHasWonPrize(true)
        setMessage({ text: `🎊 十連抽中獲得 ${wins.length} 個獎品！請到賣貨便下單付運費`, type: 'success', link: CONVENIENCE_STORE_LINK })
        for (const win of wins) {
          await supabase.from('win_notifications').insert({ discord_id: user.id, discord_name: user.displayName, item_type: 'gacha_multi', item_name: win.name })
        }
        sendWebhookNotification('福引十連抽', wins.map(w => w.name).join(', '), user.displayName, user.id)
      } else {
        setMessage({ text: '十連抽結束，已獲得 3 個鯛魚燒回饋！', type: 'info' })
      }
      loadPrizes()
    }, 3000)
  }

  const performDraw = async () => {
    const { data: allPrizes } = await supabase.from('prizes').select('*').gt('quantity', 0)
    let result = { name: '⚪ 銘謝惠顧', isWin: false }
    if (allPrizes && allPrizes.length > 0) {
      const totalProb = allPrizes.reduce((sum, p) => sum + parseFloat(p.probability), 0)
      const draw = Math.random() * (totalProb + 0.97)
      let cumulative = 0
      for (const prize of allPrizes) {
        cumulative += parseFloat(prize.probability)
        if (draw < cumulative) {
          result = { name: prize.name, isWin: true, prize }
          await supabase.from('prizes').update({ quantity: prize.quantity - 1 }).eq('id', prize.id)
          break
        }
      }
    }
    return result
  }

  const sendWebhookNotification = async (type, itemName, userName, oderId) => {
    try {
      await fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, itemName, userName, oderId }) })
    } catch (err) { console.error('Webhook error:', err) }
  }

  const handleShippingSubmit = async (e) => {
    e.preventDefault()
    if (!user || !shippingForm.recipientName || !shippingForm.phone || !shippingForm.address || !shippingForm.itemName) {
      setMessage({ text: '請填寫所有必填欄位', type: 'error' })
      return
    }
    try {
      await supabase.from('shipping_orders').insert({ discord_id: user.id, discord_name: user.displayName, item_type: 'shipping', item_name: shippingForm.itemName, recipient_name: shippingForm.recipientName, phone: shippingForm.phone, address: shippingForm.address, notes: shippingForm.notes })
      setMessage({ text: '✅ 郵寄資料已送出！管理員會盡快處理', type: 'success' })
      setShippingForm({ recipientName: '', phone: '', address: '', itemName: '', notes: '' })
      sendWebhookNotification('郵寄申請', shippingForm.itemName, user.displayName, user.id)
    } catch (err) { setMessage({ text: '送出失敗，請稍後再試', type: 'error' }) }
  }

  const handleRedeemCode = async () => {
    if (!user || !redeemCode.trim()) {
      setMessage({ text: '請輸入兌換碼', type: 'error' })
      return
    }
    setIsRedeeming(true)
    try {
      // 查詢兌換碼
      const { data: codeData, error: codeError } = await supabase
        .from('exchange_codes')
        .select('*')
        .eq('code', redeemCode.trim().toUpperCase())
        .eq('is_active', true)
        .single()

      if (codeError || !codeData) {
        setMessage({ text: '❌ 無效的兌換碼', type: 'error' })
        setIsRedeeming(false)
        return
      }

      // 檢查時間限制
      const now = new Date()
      if (codeData.start_time && new Date(codeData.start_time) > now) {
        setMessage({ text: '⏰ 此兌換碼尚未開放', type: 'error' })
        setIsRedeeming(false)
        return
      }
      if (codeData.end_time && new Date(codeData.end_time) < now) {
        setMessage({ text: '⏰ 此兌換碼已過期', type: 'error' })
        setIsRedeeming(false)
        return
      }

      // 檢查使用次數
      if (codeData.used_count >= codeData.max_uses) {
        setMessage({ text: '❌ 此兌換碼已達使用上限', type: 'error' })
        setIsRedeeming(false)
        return
      }

      // 檢查是否已兌換過
      const { data: existingRedemption } = await supabase
        .from('code_redemptions')
        .select('id')
        .eq('code_id', codeData.id)
        .eq('discord_id', user.id)
        .single()

      if (existingRedemption) {
        setMessage({ text: '❌ 你已經兌換過此代碼了', type: 'error' })
        setIsRedeeming(false)
        return
      }

      // 執行兌換
      const newPoints = (dbUser?.points || 0) + codeData.points
      await supabase.from('users').upsert({ discord_id: user.id, points: newPoints }, { onConflict: 'discord_id' })
      await supabase.from('exchange_codes').update({ used_count: codeData.used_count + 1 }).eq('id', codeData.id)
      await supabase.from('code_redemptions').insert({ code_id: codeData.id, discord_id: user.id })

      setDbUser({ ...dbUser, points: newPoints, notFound: false })
      setMessage({ text: `🎉 兌換成功！獲得 ${codeData.points} 個鯛魚燒！`, type: 'success' })
      setRedeemCode('')
      sendWebhookNotification('兌換碼', `${codeData.code} (+${codeData.points}點)`, user.displayName, user.id)
    } catch (err) {
      console.error('Redeem error:', err)
      setMessage({ text: '兌換失敗，請稍後再試', type: 'error' })
    }
    setIsRedeeming(false)
  }

  if (loading) return <main className="min-h-screen flex items-center justify-center"><div className="text-2xl text-orange-600">載入中...</div></main>

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="text-center mb-6">
        <h1 className="text-4xl md:text-5xl font-bold text-orange-600 mb-2">🐟 鯛魚燒商城</h1>
        <p className="text-gray-600">使用鯛魚燒點數兌換精美獎品</p>
        {user && user.id === ADMIN_ID && <a href="/admin" className="inline-block mt-2 text-sm text-orange-500 hover:text-orange-700 underline">🔧 管理後台</a>}
      </div>

      {error && <div className="max-w-md mx-auto mb-6 p-4 bg-red-100 text-red-700 rounded-lg text-center">{error}</div>}

      {!user ? (
        <div className="max-w-lg mx-auto">
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">🔑 登入</h2>
            <p className="text-gray-600 text-center mb-6">使用 Discord 帳號登入以查看點數和兌換獎品</p>
            <button onClick={handleLogin} className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
              使用 Discord 登入
            </button>
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">📜 規則說明</h2>
            <div className="space-y-4 text-gray-700">
              <div className="bg-orange-50 rounded-lg p-4"><h3 className="font-bold text-orange-700 mb-2">🏠 關於本站</h3><p className="text-sm">本網頁為 35p 的菁英植物園 Discord 伺服器內部點數兌換區，點數僅能透過伺服器內活動獲得。</p></div>
              <div className="bg-blue-50 rounded-lg p-4"><h3 className="font-bold text-blue-700 mb-2">📦 運費說明</h3><p className="text-sm mb-2">獎品運費由得獎者負擔，無論地球上哪個角落都寄給你！</p><p className="text-sm font-medium">台灣地區運費參考：</p><ul className="list-disc list-inside ml-2 mt-1 text-sm"><li>7-11 賣貨便：58 元</li><li>郵政掛號：80 元</li></ul></div>
              <div className="bg-green-50 rounded-lg p-4"><h3 className="font-bold text-green-700 mb-2">🎰 福引說明</h3><ul className="text-sm space-y-1"><li>• 單抽：消耗 <span className="font-bold text-orange-600">3 個鯛魚燒</span></li><li>• 十連抽：消耗 <span className="font-bold text-orange-600">30 個鯛魚燒</span>，額外贈送 <span className="font-bold text-orange-600">3 個鯛魚燒</span></li><li>• 每 35 抽達成天井，可選擇指定獎品</li></ul></div>
              <div className="bg-purple-50 rounded-lg p-4"><h3 className="font-bold text-purple-700 mb-2">🎁 兌換方式</h3><ul className="text-sm space-y-1"><li>• 中獎後請至賣貨便下單付運費</li><li>• 或選擇郵寄，填寫收件資料</li></ul></div>
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <img src={user.avatar} alt={user.displayName} className="w-16 h-16 rounded-full border-4 border-orange-200"/>
                <div><p className="text-gray-600 text-sm">歡迎回來</p><p className="text-xl font-bold text-gray-800">{user.displayName}</p><p className="text-gray-500 text-sm">@{user.username}</p></div>
              </div>
              <div className="text-right"><p className="text-gray-600 text-sm">你的鯛魚燒</p><p className="text-3xl font-bold text-orange-600">🐟 {dbUser?.points?.toLocaleString() || 0} 個</p>{dbUser?.notFound && <p className="text-xs text-red-500 mt-1">尚未在伺服器獲得點數</p>}</div>
            </div>
            <div className="mt-4 pt-4 border-t flex justify-between items-center">
              <button onClick={refreshPoints} className="text-orange-500 hover:text-orange-700 text-sm">🔄 重新整理點數</button>
              <button onClick={handleLogout} className="text-gray-500 hover:text-gray-700 text-sm">登出</button>
            </div>
          </div>

          {message.text && (
            <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800' : message.type === 'info' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>
              <p>{message.text}</p>
              {message.link && <a href={message.link} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">📦 前往賣貨便下單</a>}
              <button onClick={() => setMessage({ text: '', type: '' })} className="ml-4 text-sm underline">關閉</button>
            </div>
          )}

          <div className="mb-6">
            <div className="flex bg-white rounded-xl shadow p-1 flex-wrap">
              <button onClick={() => setActiveTab('rewards')} className={`flex-1 py-3 px-4 rounded-lg font-medium transition min-w-[80px] ${activeTab === 'rewards' ? 'bg-orange-500 text-white' : 'text-gray-600 hover:bg-orange-100'}`}>🎁 兌換獎品</button>
              <button onClick={() => setActiveTab('gacha')} className={`flex-1 py-3 px-4 rounded-lg font-medium transition min-w-[80px] ${activeTab === 'gacha' ? 'bg-orange-500 text-white' : 'text-gray-600 hover:bg-orange-100'}`}>🎰 福引抽獎</button>
              <button onClick={() => setActiveTab('code')} className={`flex-1 py-3 px-4 rounded-lg font-medium transition min-w-[80px] ${activeTab === 'code' ? 'bg-orange-500 text-white' : 'text-gray-600 hover:bg-orange-100'}`}>🎫 兌換碼</button>
              {hasWonPrize && <button onClick={() => setActiveTab('shipping')} className={`flex-1 py-3 px-4 rounded-lg font-medium transition min-w-[80px] ${activeTab === 'shipping' ? 'bg-orange-500 text-white' : 'text-gray-600 hover:bg-orange-100'}`}>📦 郵寄資料</button>}
            </div>
          </div>

          {activeTab === 'rewards' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">🎁 可兌換獎品</h2>
              {rewards.length === 0 ? <div className="bg-white rounded-2xl shadow-lg p-8 text-center text-gray-500">目前沒有可兌換的獎品</div> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {rewards.map((reward) => (
                    <div key={reward.id} className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition">
                      <div className="h-48 bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center">
                        {reward.image_url ? <img src={reward.image_url} alt={reward.name} className="w-full h-full object-cover"/> : <span className="text-6xl">🎁</span>}
                      </div>
                      <div className="p-4">
                        <h3 className="text-lg font-bold text-gray-800 mb-1">{reward.name}</h3>
                        {reward.description && <p className="text-sm text-gray-500 mb-2">{reward.description}</p>}
                        <div className="flex justify-between items-center mb-3"><span className="text-orange-600 font-bold">🐟 {reward.cost} 個</span><span className="text-gray-500 text-sm">剩餘 {reward.quantity}</span></div>
                        <button onClick={() => handleRedeem(reward)} disabled={!dbUser || dbUser.points < reward.cost} className={`w-full py-2 rounded-lg font-bold transition ${dbUser && dbUser.points >= reward.cost ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}>{!dbUser || dbUser.points < reward.cost ? '點數不足' : '兌換'}</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'gacha' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">🎰 福引抽獎</h2>
              <div className="bg-white rounded-2xl shadow-lg p-8 max-w-lg mx-auto">
                <div className="text-center mb-6"><p className="text-gray-600">單抽：<span className="text-orange-600 font-bold">3 個鯛魚燒</span></p><p className="text-gray-600">十連抽：<span className="text-orange-600 font-bold">30 個鯛魚燒</span><span className="text-green-600 ml-2">（送 3 個回饋！）</span></p></div>
                <div className="h-48 flex items-center justify-center mb-6 bg-gradient-to-br from-orange-50 to-yellow-50 rounded-xl">
                  {isDrawing ? <div className="text-center"><div className="animate-bounce text-6xl mb-2">🎰</div><p className="text-gray-600">抽獎中...</p></div>
                  : drawResults.length > 0 ? <div className="text-center w-full px-4"><p className="font-bold mb-2">十連抽結果：</p><div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto">{drawResults.map((result, idx) => <div key={idx} className={`text-sm p-2 rounded ${result.isWin ? 'bg-yellow-100 text-yellow-800 font-bold' : 'bg-gray-100 text-gray-600'}`}>{idx + 1}. {result.name}</div>)}</div></div>
                  : drawResult ? <div className={`text-center ${drawResult.isWin ? 'animate-pulse' : ''}`}><div className={`text-4xl font-bold ${drawResult.isWin ? 'text-yellow-500' : 'text-gray-500'}`}>{drawResult.name}</div>{drawResult.isWin && <p className="text-yellow-600 mt-2">🎊 恭喜中獎！</p>}</div>
                  : <div className="text-6xl">🐟</div>}
                </div>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <button onClick={handleSingleDraw} disabled={isDrawing || !dbUser || dbUser.points < 3} className={`py-3 rounded-lg font-bold text-lg transition ${!isDrawing && dbUser && dbUser.points >= 3 ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}>{isDrawing ? '...' : '單抽 (3)'}</button>
                  <button onClick={handleMultiDraw} disabled={isDrawing || !dbUser || dbUser.points < 30} className={`py-3 rounded-lg font-bold text-lg transition ${!isDrawing && dbUser && dbUser.points >= 30 ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}>{isDrawing ? '...' : '十連抽 (30)'}</button>
                </div>
                <div className="border-t pt-4"><h3 className="font-bold text-gray-700 mb-2">🎁 獎品池</h3><div className="space-y-2 max-h-48 overflow-y-auto">{prizes.map((prize) => <div key={prize.id} className="flex justify-between items-center bg-gray-50 p-2 rounded"><span>{prize.name}</span><span className="text-sm text-gray-500">剩 {prize.quantity}</span></div>)}{prizes.length === 0 && <p className="text-gray-500 text-center py-4">暫無獎品</p>}</div></div>
              </div>
            </div>
          )}

          {activeTab === 'code' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">🎫 兌換碼</h2>
              <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md mx-auto">
                <div className="text-center mb-6">
                  <div className="text-6xl mb-4">🎁</div>
                  <p className="text-gray-600">輸入兌換碼獲得鯛魚燒！</p>
                  <p className="text-sm text-gray-500 mt-2">兌換碼可從 Discord 活動中獲得</p>
                </div>
                <div className="space-y-4">
                  <input
                    type="text"
                    value={redeemCode}
                    onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                    placeholder="請輸入兌換碼"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-center text-xl font-mono uppercase focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition"
                    maxLength={20}
                  />
                  <button
                    onClick={handleRedeemCode}
                    disabled={isRedeeming || !redeemCode.trim()}
                    className={`w-full py-3 rounded-xl font-bold text-lg transition ${
                      !isRedeeming && redeemCode.trim()
                        ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {isRedeeming ? '兌換中...' : '🎉 兌換'}
                  </button>
                </div>
                <div className="mt-6 pt-6 border-t">
                  <h3 className="font-bold text-gray-700 mb-3">💡 如何獲得兌換碼？</h3>
                  <ul className="text-sm text-gray-600 space-y-2">
                    <li>• 參加 Discord 伺服器活動</li>
                    <li>• 特殊節日限定發放</li>
                    <li>• 管理員不定期放送</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'shipping' && hasWonPrize && (
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">📦 郵寄資料</h2>
              <div className="bg-white rounded-2xl shadow-lg p-6 max-w-lg mx-auto">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6"><p className="text-yellow-800 text-sm">💡 如果您選擇使用<strong>賣貨便</strong>，請直接到<a href={CONVENIENCE_STORE_LINK} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline ml-1">此連結</a>下單付運費即可，不需填寫此表單。</p><p className="text-yellow-800 text-sm mt-2">📮 此表單僅供選擇<strong>郵寄</strong>方式的用戶填寫。</p></div>
                <form onSubmit={handleShippingSubmit} className="space-y-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">獎品名稱 <span className="text-red-500">*</span></label><input type="text" value={shippingForm.itemName} onChange={(e) => setShippingForm({...shippingForm, itemName: e.target.value})} placeholder="請輸入您要領取的獎品名稱" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500" required/></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">收件人姓名 <span className="text-red-500">*</span></label><input type="text" value={shippingForm.recipientName} onChange={(e) => setShippingForm({...shippingForm, recipientName: e.target.value})} placeholder="真實姓名" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500" required/></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">聯絡電話 <span className="text-red-500">*</span></label><input type="tel" value={shippingForm.phone} onChange={(e) => setShippingForm({...shippingForm, phone: e.target.value})} placeholder="09XX-XXX-XXX" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500" required/></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">郵寄地址 <span className="text-red-500">*</span></label><textarea value={shippingForm.address} onChange={(e) => setShippingForm({...shippingForm, address: e.target.value})} placeholder="完整郵寄地址（含郵遞區號）" rows={2} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500" required/></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">備註（選填）</label><textarea value={shippingForm.notes} onChange={(e) => setShippingForm({...shippingForm, notes: e.target.value})} placeholder="其他需要說明的事項" rows={2} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"/></div>
                  <button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-4 rounded-lg transition">📮 送出郵寄資料</button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      <footer className="text-center mt-12 text-gray-500 text-sm"><p>在 Discord 使用 /鯛魚燒 查看點數</p><p className="mt-1">巫女様神社 ⛩️</p></footer>
    </main>
  )
}
