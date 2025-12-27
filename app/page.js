'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

// Supabase 客戶端（從環境變數讀取）
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

export default function Home() {
  const [discordId, setDiscordId] = useState('')
  const [user, setUser] = useState(null)
  const [rewards, setRewards] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  // 載入商品列表
  useEffect(() => {
    if (supabase) {
      loadRewards()
    }
  }, [])

  const loadRewards = async () => {
    const { data, error } = await supabase
      .from('rewards')
      .select('*')
      .gt('quantity', 0)
      .order('cost', { ascending: true })
    
    if (data) {
      setRewards(data)
    }
  }

  // 查詢用戶點數
  const handleLogin = async () => {
    if (!discordId.trim()) {
      setMessage('請輸入 Discord ID')
      return
    }

    setLoading(true)
    setMessage('')

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('discord_id', discordId.trim())
        .single()

      if (error || !data) {
        setMessage('找不到此用戶，請確認 Discord ID 是否正確')
        setUser(null)
        setIsLoggedIn(false)
      } else {
        setUser(data)
        setIsLoggedIn(true)
        setMessage('')
      }
    } catch (err) {
      setMessage('查詢失敗，請稍後再試')
    }

    setLoading(false)
  }

  // 兌換獎品
  const handleRedeem = async (reward) => {
    if (!user) return

    if (user.points < reward.cost) {
      setMessage(`鯛魚燒不夠！需要 ${reward.cost} 個，你只有 ${user.points} 個`)
      return
    }

    setLoading(true)

    try {
      // 扣除點數
      const { error: pointsError } = await supabase
        .from('users')
        .update({ points: user.points - reward.cost })
        .eq('discord_id', user.discord_id)

      if (pointsError) throw pointsError

      // 扣除獎品數量
      const { error: rewardError } = await supabase
        .from('rewards')
        .update({ quantity: reward.quantity - 1 })
        .eq('id', reward.id)

      if (rewardError) throw rewardError

      // 更新本地狀態
      setUser({ ...user, points: user.points - reward.cost })
      setMessage(`🎉 成功兌換「${reward.name}」！請到 Discord 聯絡管理員領取`)
      loadRewards()
    } catch (err) {
      setMessage('兌換失敗，請稍後再試')
    }

    setLoading(false)
  }

  // 登出
  const handleLogout = () => {
    setUser(null)
    setIsLoggedIn(false)
    setDiscordId('')
    setMessage('')
  }

  return (
    <main className="min-h-screen p-4 md:p-8">
      {/* 標題 */}
      <div className="text-center mb-8">
        <h1 className="text-4xl md:text-5xl font-bold text-orange-600 mb-2">
          🐟 鯛魚燒商城
        </h1>
        <p className="text-gray-600">使用鯛魚燒點數兌換精美獎品</p>
      </div>

      {/* 未連接 Supabase 的提示 */}
      {!supabase && (
        <div className="max-w-md mx-auto bg-yellow-100 border border-yellow-400 rounded-lg p-4 mb-8">
          <p className="text-yellow-800">
            ⚠️ 尚未設定 Supabase 連線，請在 Vercel 設定環境變數
          </p>
        </div>
      )}

      {/* 登入區塊 */}
      {!isLoggedIn ? (
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4">🔑 查詢點數</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                你的 Discord ID
              </label>
              <input
                type="text"
                value={discordId}
                onChange={(e) => setDiscordId(e.target.value)}
                placeholder="例如：592515542208872555"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                在 Discord 開啟開發者模式，右鍵點擊自己 → 複製 ID
              </p>
            </div>
            <button
              onClick={handleLogin}
              disabled={loading || !supabase}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded-lg transition"
            >
              {loading ? '查詢中...' : '查詢'}
            </button>
          </div>
        </div>
      ) : (
        /* 用戶資訊 */
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-gray-600">你的鯛魚燒</p>
              <p className="text-3xl font-bold text-orange-600">
                🐟 {user.points} 個
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="text-gray-500 hover:text-gray-700"
            >
              登出
            </button>
          </div>
        </div>
      )}

      {/* 訊息提示 */}
      {message && (
        <div className={`max-w-md mx-auto mb-8 p-4 rounded-lg ${
          message.includes('成功') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {message}
        </div>
      )}

      {/* 商品列表 */}
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">🎁 可兌換獎品</h2>
        
        {rewards.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center text-gray-500">
            目前沒有可兌換的獎品
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rewards.map((reward) => (
              <div
                key={reward.id}
                className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition"
              >
                <div className="text-4xl mb-3">🎁</div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">
                  {reward.name}
                </h3>
                <div className="flex justify-between items-center mb-4">
                  <span className="text-orange-600 font-bold">
                    🐟 {reward.cost} 個
                  </span>
                  <span className="text-gray-500 text-sm">
                    剩餘 {reward.quantity} 個
                  </span>
                </div>
                <button
                  onClick={() => handleRedeem(reward)}
                  disabled={!isLoggedIn || loading || (user && user.points < reward.cost)}
                  className={`w-full py-2 px-4 rounded-lg font-bold transition ${
                    isLoggedIn && user && user.points >= reward.cost
                      ? 'bg-orange-500 hover:bg-orange-600 text-white'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {!isLoggedIn 
                    ? '請先登入' 
                    : user && user.points < reward.cost 
                      ? '點數不足' 
                      : '兌換'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 頁尾 */}
      <footer className="text-center mt-12 text-gray-500 text-sm">
        <p>在 Discord 使用 /鯛魚燒 查看點數</p>
        <p className="mt-1">巫女様神社 ⛩️</p>
      </footer>
    </main>
  )
}
