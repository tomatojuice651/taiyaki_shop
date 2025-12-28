'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

const ADMIN_ID = '592515542208872555'

export default function AdminPage() {
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [activeTab, setActiveTab] = useState('rewards')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState({ text: '', type: '' })

  const [rewards, setRewards] = useState([])
  const [prizes, setPrizes] = useState([])
  const [orders, setOrders] = useState([])
  const [codes, setCodes] = useState([])
  const [notifications, setNotifications] = useState([])
  
  // 紀錄相關
  const [drawRecords, setDrawRecords] = useState([])
  const [redemptionRecords, setRedemptionRecords] = useState([])
  const [codeRedemptions, setCodeRedemptions] = useState([])
  const [recordTab, setRecordTab] = useState('notifications') // notifications, draws, redemptions, codes

  const [rewardForm, setRewardForm] = useState({ name: '', cost: '', quantity: '', description: '', image_url: '' })
  const [prizeForm, setPrizeForm] = useState({ name: '', quantity: '', probability: '0.01', description: '', image_url: '' })
  const [codeForm, setCodeForm] = useState({ code: '', points: '', max_uses: '1', description: '', start_time: '', end_time: '' })
  
  const [editingReward, setEditingReward] = useState(null)
  const [editingPrize, setEditingPrize] = useState(null)
  const [editingCode, setEditingCode] = useState(null)
  const [uploading, setUploading] = useState(false)
  
  // 用戶管理
  const [users, setUsers] = useState([])
  const [userSearch, setUserSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [pointsAdjust, setPointsAdjust] = useState('')
  const [darkMode, setDarkMode] = useState(false)

  // 深色模式初始化
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme === 'dark') {
      setDarkMode(true)
      document.documentElement.setAttribute('data-theme', 'dark')
    }
  }, [])

  const toggleDarkMode = () => {
    const newMode = !darkMode
    setDarkMode(newMode)
    if (newMode) {
      document.documentElement.setAttribute('data-theme', 'dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.removeAttribute('data-theme')
      localStorage.setItem('theme', 'light')
    }
  }

  // 檢查兌換碼是否過期
  const isCodeExpired = (code) => {
    if (!code.end_time) return false
    return new Date(code.end_time) < new Date()
  }

  useEffect(() => {
    const savedUser = localStorage.getItem('discord_user')
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser)
        if (userData.id === ADMIN_ID) {
          setIsAuthorized(true)
        }
      } catch (e) {}
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (isAuthorized && supabase) {
      loadAllData()
    }
  }, [isAuthorized])

  const loadAllData = async () => {
    await Promise.all([loadRewards(), loadPrizes(), loadOrders(), loadCodes(), loadNotifications(), loadUsers(), loadDrawRecords(), loadRedemptionRecords(), loadCodeRedemptions()])
  }

  const loadRewards = async () => {
    const { data } = await supabase.from('rewards').select('*').order('id', { ascending: true })
    if (data) setRewards(data)
  }

  const loadPrizes = async () => {
    const { data } = await supabase.from('prizes').select('*').order('id', { ascending: true })
    if (data) setPrizes(data)
  }

  const loadOrders = async () => {
    const { data } = await supabase.from('shipping_orders').select('*').order('created_at', { ascending: false })
    if (data) setOrders(data)
  }

  const loadCodes = async () => {
    const { data } = await supabase.from('exchange_codes').select('*').order('created_at', { ascending: false })
    if (data) setCodes(data)
  }

  const loadUsers = async () => {
    const { data } = await supabase.from('users').select('*').order('points', { ascending: false }).limit(100)
    if (data) setUsers(data)
  }

  const searchUser = async () => {
    if (!userSearch.trim()) {
      loadUsers()
      return
    }
    const { data } = await supabase
      .from('users')
      .select('*')
      .or(`discord_id.ilike.%${userSearch}%`)
      .limit(50)
    if (data) setUsers(data)
  }

  const adjustUserPoints = async (discordId, amount) => {
    const user = users.find(u => u.discord_id === discordId)
    if (!user) return
    
    const newPoints = Math.max(0, user.points + amount)
    await supabase.from('users').update({ points: newPoints }).eq('discord_id', discordId)
    setMessage({ text: `✅ 已調整點數：${amount > 0 ? '+' : ''}${amount}，現有 ${newPoints} 點`, type: 'success' })
    loadUsers()
    setPointsAdjust('')
  }

  const setUserPoints = async (discordId, newPoints) => {
    await supabase.from('users').update({ points: parseInt(newPoints) }).eq('discord_id', discordId)
    setMessage({ text: `✅ 已設定點數為 ${newPoints} 點`, type: 'success' })
    loadUsers()
    setSelectedUser(null)
  }

  const loadNotifications = async () => {
    const { data } = await supabase.from('win_notifications').select('*').order('created_at', { ascending: false }).limit(50)
    if (data) setNotifications(data)
  }

  // 載入福引抽獎紀錄
  const loadDrawRecords = async () => {
    const { data } = await supabase
      .from('draw_records')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    if (data) setDrawRecords(data)
  }

  // 載入獎品兌換紀錄
  const loadRedemptionRecords = async () => {
    const { data } = await supabase
      .from('redemption_orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    if (data) setRedemptionRecords(data)
  }

  // 載入兌換碼使用紀錄
  const loadCodeRedemptions = async () => {
    const { data } = await supabase
      .from('code_redemptions')
      .select('*, exchange_codes(code, points, description)')
      .order('redeemed_at', { ascending: false })
      .limit(100)
    if (data) setCodeRedemptions(data)
  }

  // 載入所有紀錄
  const loadAllRecords = async () => {
    await Promise.all([
      loadNotifications(),
      loadDrawRecords(),
      loadRedemptionRecords(),
      loadCodeRedemptions()
    ])
  }

  const handleImageUpload = async (file, type) => {
    if (!file) return null
    setUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${type}_${Date.now()}.${fileExt}`
      
      // 嘗試上傳
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })
      
      if (uploadError) {
        console.error('Upload error:', uploadError)
        setMessage({ text: `圖片上傳失敗: ${uploadError.message}`, type: 'error' })
        setUploading(false)
        return null
      }
      
      // 取得公開 URL
      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName)
      
      console.log('Upload success, URL:', urlData.publicUrl)
      setUploading(false)
      setMessage({ text: '✅ 圖片上傳成功', type: 'success' })
      return urlData.publicUrl
    } catch (err) {
      console.error('Upload error:', err)
      setUploading(false)
      setMessage({ text: `圖片上傳失敗: ${err.message}`, type: 'error' })
      return null
    }
  }

  // 獎品管理
  const handleSaveReward = async () => {
    if (!rewardForm.name || !rewardForm.cost || !rewardForm.quantity) {
      setMessage({ text: '請填寫必填欄位', type: 'error' })
      return
    }
    try {
      const data = { name: rewardForm.name, cost: parseInt(rewardForm.cost), quantity: parseInt(rewardForm.quantity), description: rewardForm.description || null, image_url: rewardForm.image_url || null }
      if (editingReward) {
        await supabase.from('rewards').update(data).eq('id', editingReward.id)
        setMessage({ text: '✅ 獎品已更新', type: 'success' })
      } else {
        await supabase.from('rewards').insert(data)
        setMessage({ text: '✅ 獎品已新增', type: 'success' })
      }
      setRewardForm({ name: '', cost: '', quantity: '', description: '', image_url: '' })
      setEditingReward(null)
      loadRewards()
    } catch (err) { setMessage({ text: '操作失敗', type: 'error' }) }
  }

  const handleDeleteReward = async (id) => {
    if (!confirm('確定要刪除此獎品嗎？')) return
    await supabase.from('rewards').delete().eq('id', id)
    setMessage({ text: '✅ 已刪除', type: 'success' })
    loadRewards()
  }

  // 福引獎品管理
  const handleSavePrize = async () => {
    if (!prizeForm.name || !prizeForm.quantity) {
      setMessage({ text: '請填寫必填欄位', type: 'error' })
      return
    }
    try {
      const data = { name: prizeForm.name, quantity: parseInt(prizeForm.quantity), probability: parseFloat(prizeForm.probability), description: prizeForm.description || null, image_url: prizeForm.image_url || null }
      if (editingPrize) {
        await supabase.from('prizes').update(data).eq('id', editingPrize.id)
        setMessage({ text: '✅ 福引獎品已更新', type: 'success' })
      } else {
        await supabase.from('prizes').insert(data)
        setMessage({ text: '✅ 福引獎品已新增', type: 'success' })
      }
      setPrizeForm({ name: '', quantity: '', probability: '0.01', description: '', image_url: '' })
      setEditingPrize(null)
      loadPrizes()
    } catch (err) { setMessage({ text: '操作失敗', type: 'error' }) }
  }

  const handleDeletePrize = async (id) => {
    if (!confirm('確定要刪除此福引獎品嗎？')) return
    await supabase.from('prizes').delete().eq('id', id)
    setMessage({ text: '✅ 已刪除', type: 'success' })
    loadPrizes()
  }

  // 兌換碼管理
  const handleSaveCode = async () => {
    if (!codeForm.code || !codeForm.points) {
      setMessage({ text: '請填寫必填欄位', type: 'error' })
      return
    }
    try {
      const data = {
        code: codeForm.code.toUpperCase(),
        points: parseInt(codeForm.points),
        max_uses: parseInt(codeForm.max_uses) || 1,
        description: codeForm.description || null,
        start_time: codeForm.start_time || null,
        end_time: codeForm.end_time || null,
        is_active: true
      }
      if (editingCode) {
        await supabase.from('exchange_codes').update(data).eq('id', editingCode.id)
        setMessage({ text: '✅ 兌換碼已更新', type: 'success' })
      } else {
        await supabase.from('exchange_codes').insert(data)
        setMessage({ text: '✅ 兌換碼已新增', type: 'success' })
      }
      setCodeForm({ code: '', points: '', max_uses: '1', description: '', start_time: '', end_time: '' })
      setEditingCode(null)
      loadCodes()
    } catch (err) { 
      if (err.message?.includes('duplicate')) {
        setMessage({ text: '此兌換碼已存在', type: 'error' })
      } else {
        setMessage({ text: '操作失敗', type: 'error' })
      }
    }
  }

  const handleDeleteCode = async (id) => {
    if (!confirm('確定要刪除此兌換碼嗎？')) return
    await supabase.from('exchange_codes').delete().eq('id', id)
    setMessage({ text: '✅ 已刪除', type: 'success' })
    loadCodes()
  }

  const toggleCodeActive = async (code) => {
    await supabase.from('exchange_codes').update({ is_active: !code.is_active }).eq('id', code.id)
    loadCodes()
  }

  // 訂單管理
  const updateOrderStatus = async (id, status) => {
    await supabase.from('shipping_orders').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    setMessage({ text: '✅ 狀態已更新', type: 'success' })
    loadOrders()
  }

  // 通知狀態管理
  const toggleNotificationStatus = async (notification) => {
    await supabase.from('win_notifications').update({ notified: !notification.notified }).eq('id', notification.id)
    setMessage({ text: '✅ 狀態已更新', type: 'success' })
    loadNotifications()
  }

  const deleteNotification = async (id) => {
    if (!confirm('確定要刪除此通知嗎？')) return
    await supabase.from('win_notifications').delete().eq('id', id)
    setMessage({ text: '✅ 已刪除', type: 'success' })
    loadNotifications()
  }

  if (loading) return <main className="min-h-screen flex items-center justify-center"><div className="text-2xl text-orange-600">載入中...</div></main>

  if (!isAuthorized) {
    return (
      <main className="min-h-screen p-8 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">🔐 管理後台</h1>
          <p className="text-gray-600 mb-6">請先從首頁使用 Discord 登入</p>
          <a href="/" className="inline-block bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-6 rounded-lg">返回首頁登入</a>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-4 md:p-8 bg-gray-100">
      {/* 深色模式切換按鈕 */}
      <button
        onClick={toggleDarkMode}
        className="fixed top-4 right-4 z-50 p-2 rounded-full bg-white shadow-lg hover:shadow-xl transition"
        title={darkMode ? '切換淺色模式' : '切換深色模式'}
      >
        {darkMode ? '☀️' : '🌙'}
      </button>

      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-orange-600">🔧 管理後台</h1>
          <a href="/" className="text-gray-500 hover:text-gray-700">← 返回商城</a>
        </div>

        {message.text && (
          <div className={`mb-4 p-3 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {message.text}
            <button onClick={() => setMessage({ text: '', type: '' })} className="ml-4 underline">關閉</button>
          </div>
        )}

        <div className="flex bg-white rounded-xl shadow p-1 mb-6 flex-wrap">
          <button onClick={() => setActiveTab('rewards')} className={`flex-1 py-2 px-4 rounded-lg font-medium transition min-w-[80px] ${activeTab === 'rewards' ? 'bg-orange-500 text-white' : 'text-gray-600 hover:bg-orange-100'}`}>🎁 獎品</button>
          <button onClick={() => setActiveTab('prizes')} className={`flex-1 py-2 px-4 rounded-lg font-medium transition min-w-[80px] ${activeTab === 'prizes' ? 'bg-orange-500 text-white' : 'text-gray-600 hover:bg-orange-100'}`}>🎰 福引</button>
          <button onClick={() => setActiveTab('codes')} className={`flex-1 py-2 px-4 rounded-lg font-medium transition min-w-[80px] ${activeTab === 'codes' ? 'bg-orange-500 text-white' : 'text-gray-600 hover:bg-orange-100'}`}>🎫 兌換碼</button>
          <button onClick={() => setActiveTab('users')} className={`flex-1 py-2 px-4 rounded-lg font-medium transition min-w-[80px] ${activeTab === 'users' ? 'bg-orange-500 text-white' : 'text-gray-600 hover:bg-orange-100'}`}>👥 用戶</button>
          <button onClick={() => setActiveTab('orders')} className={`flex-1 py-2 px-4 rounded-lg font-medium transition min-w-[80px] ${activeTab === 'orders' ? 'bg-orange-500 text-white' : 'text-gray-600 hover:bg-orange-100'}`}>📦 訂單</button>
          <button onClick={() => setActiveTab('notifications')} className={`flex-1 py-2 px-4 rounded-lg font-medium transition min-w-[80px] ${activeTab === 'notifications' ? 'bg-orange-500 text-white' : 'text-gray-600 hover:bg-orange-100'}`}>🔔 通知</button>
        </div>

        {/* 兌換獎品管理 */}
        {activeTab === 'rewards' && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4">{editingReward ? '編輯獎品' : '新增獎品'}</h2>
              <div className="space-y-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">名稱 *</label><input type="text" value={rewardForm.name} onChange={(e) => setRewardForm({...rewardForm, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg"/></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">所需點數 *</label><input type="number" value={rewardForm.cost} onChange={(e) => setRewardForm({...rewardForm, cost: e.target.value})} className="w-full px-3 py-2 border rounded-lg"/></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">數量 *</label><input type="number" value={rewardForm.quantity} onChange={(e) => setRewardForm({...rewardForm, quantity: e.target.value})} className="w-full px-3 py-2 border rounded-lg"/></div>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">說明</label><textarea value={rewardForm.description} onChange={(e) => setRewardForm({...rewardForm, description: e.target.value})} className="w-full px-3 py-2 border rounded-lg" rows={2}/></div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">圖片</label>
                  <input type="file" accept="image/*" onChange={async (e) => { const url = await handleImageUpload(e.target.files[0], 'reward'); if (url) setRewardForm({...rewardForm, image_url: url}) }} className="w-full px-3 py-2 border rounded-lg mb-2"/>
                  <input type="text" value={rewardForm.image_url || ''} onChange={(e) => setRewardForm({...rewardForm, image_url: e.target.value})} placeholder="或直接貼上圖片網址" className="w-full px-3 py-2 border rounded-lg text-sm"/>
                  {uploading && <p className="text-sm text-blue-500 mt-1">上傳中...</p>}
                  {rewardForm.image_url && <img src={rewardForm.image_url} alt="preview" className="mt-2 h-20 object-cover rounded"/>}
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSaveReward} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 rounded-lg">{editingReward ? '更新' : '新增'}</button>
                  {editingReward && <button onClick={() => { setEditingReward(null); setRewardForm({ name: '', cost: '', quantity: '', description: '', image_url: '' }) }} className="px-4 bg-gray-300 hover:bg-gray-400 text-gray-700 font-bold py-2 rounded-lg">取消</button>}
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4">獎品列表 ({rewards.length})</h2>
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {rewards.map((reward) => (
                  <div key={reward.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    {reward.image_url ? <img src={reward.image_url} alt="" className="w-12 h-12 object-cover rounded"/> : <div className="w-12 h-12 bg-orange-100 rounded flex items-center justify-center">🎁</div>}
                    <div className="flex-1"><p className="font-medium">{reward.name}</p><p className="text-sm text-gray-500">💰 {reward.cost} 點 | 剩餘 {reward.quantity}</p></div>
                    <button onClick={() => { setEditingReward(reward); setRewardForm({ name: reward.name, cost: reward.cost.toString(), quantity: reward.quantity.toString(), description: reward.description || '', image_url: reward.image_url || '' }) }} className="text-blue-500 hover:text-blue-700">✏️</button>
                    <button onClick={() => handleDeleteReward(reward.id)} className="text-red-500 hover:text-red-700">🗑️</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 福引獎品管理 */}
        {activeTab === 'prizes' && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4">{editingPrize ? '編輯福引獎品' : '新增福引獎品'}</h2>
              <div className="space-y-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">名稱 *</label><input type="text" value={prizeForm.name} onChange={(e) => setPrizeForm({...prizeForm, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg"/></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">數量 *</label><input type="number" value={prizeForm.quantity} onChange={(e) => setPrizeForm({...prizeForm, quantity: e.target.value})} className="w-full px-3 py-2 border rounded-lg"/></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">機率</label><input type="number" step="0.001" value={prizeForm.probability} onChange={(e) => setPrizeForm({...prizeForm, probability: e.target.value})} className="w-full px-3 py-2 border rounded-lg"/></div>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">說明</label><textarea value={prizeForm.description} onChange={(e) => setPrizeForm({...prizeForm, description: e.target.value})} className="w-full px-3 py-2 border rounded-lg" rows={2}/></div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">圖片</label>
                  <input type="file" accept="image/*" onChange={async (e) => { const url = await handleImageUpload(e.target.files[0], 'prize'); if (url) setPrizeForm({...prizeForm, image_url: url}) }} className="w-full px-3 py-2 border rounded-lg mb-2"/>
                  <input type="text" value={prizeForm.image_url || ''} onChange={(e) => setPrizeForm({...prizeForm, image_url: e.target.value})} placeholder="或直接貼上圖片網址" className="w-full px-3 py-2 border rounded-lg text-sm"/>
                  {uploading && <p className="text-sm text-blue-500 mt-1">上傳中...</p>}
                  {prizeForm.image_url && <img src={prizeForm.image_url} alt="preview" className="mt-2 h-20 object-cover rounded"/>}
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSavePrize} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 rounded-lg">{editingPrize ? '更新' : '新增'}</button>
                  {editingPrize && <button onClick={() => { setEditingPrize(null); setPrizeForm({ name: '', quantity: '', probability: '0.01', description: '', image_url: '' }) }} className="px-4 bg-gray-300 hover:bg-gray-400 text-gray-700 font-bold py-2 rounded-lg">取消</button>}
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4">福引獎品列表 ({prizes.length})</h2>
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {prizes.map((prize) => (
                  <div key={prize.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    {prize.image_url ? <img src={prize.image_url} alt="" className="w-12 h-12 object-cover rounded"/> : <div className="w-12 h-12 bg-orange-100 rounded flex items-center justify-center">🎰</div>}
                    <div className="flex-1"><p className="font-medium">{prize.name}</p><p className="text-sm text-gray-500">機率 {prize.probability} | 剩餘 {prize.quantity}</p></div>
                    <button onClick={() => { setEditingPrize(prize); setPrizeForm({ name: prize.name, quantity: prize.quantity.toString(), probability: prize.probability.toString(), description: prize.description || '', image_url: prize.image_url || '' }) }} className="text-blue-500 hover:text-blue-700">✏️</button>
                    <button onClick={() => handleDeletePrize(prize.id)} className="text-red-500 hover:text-red-700">🗑️</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 兌換碼管理 */}
        {activeTab === 'codes' && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4">{editingCode ? '編輯兌換碼' : '新增兌換碼'}</h2>
              <div className="space-y-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">兌換碼 *</label><input type="text" value={codeForm.code} onChange={(e) => setCodeForm({...codeForm, code: e.target.value.toUpperCase()})} placeholder="例如: NEWYEAR2024" className="w-full px-3 py-2 border rounded-lg font-mono uppercase"/></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">點數 *</label><input type="number" value={codeForm.points} onChange={(e) => setCodeForm({...codeForm, points: e.target.value})} className="w-full px-3 py-2 border rounded-lg"/></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">最大使用次數</label><input type="number" value={codeForm.max_uses} onChange={(e) => setCodeForm({...codeForm, max_uses: e.target.value})} className="w-full px-3 py-2 border rounded-lg"/></div>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">說明</label><input type="text" value={codeForm.description} onChange={(e) => setCodeForm({...codeForm, description: e.target.value})} placeholder="例如: 新年活動" className="w-full px-3 py-2 border rounded-lg"/></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">開始時間</label><input type="datetime-local" value={codeForm.start_time} onChange={(e) => setCodeForm({...codeForm, start_time: e.target.value})} className="w-full px-3 py-2 border rounded-lg"/></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">結束時間</label><input type="datetime-local" value={codeForm.end_time} onChange={(e) => setCodeForm({...codeForm, end_time: e.target.value})} className="w-full px-3 py-2 border rounded-lg"/></div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSaveCode} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 rounded-lg">{editingCode ? '更新' : '新增'}</button>
                  {editingCode && <button onClick={() => { setEditingCode(null); setCodeForm({ code: '', points: '', max_uses: '1', description: '', start_time: '', end_time: '' }) }} className="px-4 bg-gray-300 hover:bg-gray-400 text-gray-700 font-bold py-2 rounded-lg">取消</button>}
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4">兌換碼列表 ({codes.length})</h2>
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {codes.map((code) => (
                  <div key={code.id} className={`p-3 rounded-lg ${
                    isCodeExpired(code) ? 'bg-red-50 border border-red-200' :
                    code.is_active ? 'bg-green-50' : 'bg-gray-100'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono font-bold text-lg">{code.code}</span>
                      <div className="flex gap-1">
                        {isCodeExpired(code) && (
                          <span className="px-2 py-1 rounded text-xs bg-red-200 text-red-800">已過期</span>
                        )}
                        <span className={`px-2 py-1 rounded text-xs ${code.is_active ? 'bg-green-200 text-green-800' : 'bg-gray-300 text-gray-600'}`}>
                          {code.is_active ? '啟用' : '停用'}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600">🐟 {code.points} 點 | 使用 {code.used_count}/{code.max_uses}</p>
                    {code.description && <p className="text-sm text-gray-500">{code.description}</p>}
                    {code.end_time && (
                      <p className={`text-xs mt-1 ${isCodeExpired(code) ? 'text-red-500' : 'text-gray-400'}`}>
                        到期：{new Date(code.end_time).toLocaleString('zh-TW')}
                      </p>
                    )}
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => toggleCodeActive(code)} className={`text-xs px-2 py-1 rounded ${code.is_active ? 'bg-gray-200' : 'bg-green-200'}`}>{code.is_active ? '停用' : '啟用'}</button>
                      <button onClick={() => { setEditingCode(code); setCodeForm({ code: code.code, points: code.points.toString(), max_uses: code.max_uses.toString(), description: code.description || '', start_time: code.start_time || '', end_time: code.end_time || '' }) }} className="text-blue-500 text-xs">編輯</button>
                      <button onClick={() => handleDeleteCode(code.id)} className="text-red-500 text-xs">刪除</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 郵寄訂單管理 */}
        {activeTab === 'orders' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4">郵寄訂單 ({orders.length})</h2>
            {orders.length === 0 ? <p className="text-gray-500 text-center py-8">目前沒有郵寄訂單</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left">時間</th><th className="px-3 py-2 text-left">用戶</th><th className="px-3 py-2 text-left">獎品</th><th className="px-3 py-2 text-left">收件人</th><th className="px-3 py-2 text-left">電話</th><th className="px-3 py-2 text-left">地址</th><th className="px-3 py-2 text-left">狀態</th><th className="px-3 py-2 text-left">操作</th></tr></thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id} className="border-t">
                        <td className="px-3 py-2">{new Date(order.created_at).toLocaleString('zh-TW')}</td>
                        <td className="px-3 py-2">{order.discord_name}</td>
                        <td className="px-3 py-2">{order.item_name}</td>
                        <td className="px-3 py-2">{order.recipient_name}</td>
                        <td className="px-3 py-2">{order.phone}</td>
                        <td className="px-3 py-2 max-w-[200px] truncate">{order.address}</td>
                        <td className="px-3 py-2"><span className={`px-2 py-1 rounded text-xs ${order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : order.status === 'shipped' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>{order.status === 'pending' ? '待處理' : order.status === 'shipped' ? '已寄出' : '已完成'}</span></td>
                        <td className="px-3 py-2"><select value={order.status} onChange={(e) => updateOrderStatus(order.id, e.target.value)} className="text-xs border rounded px-2 py-1"><option value="pending">待處理</option><option value="shipped">已寄出</option><option value="completed">已完成</option></select></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 用戶管理 */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">👥 用戶管理 ({users.length})</h2>
              <button onClick={loadUsers} className="text-sm text-orange-500 hover:text-orange-700">🔄 重新整理</button>
            </div>
            
            {/* 搜尋區 */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="輸入 Discord ID 搜尋..."
                className="flex-1 px-3 py-2 border rounded-lg"
              />
              <button onClick={searchUser} className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600">搜尋</button>
            </div>
            
            {/* 用戶列表 */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Discord ID</th>
                    <th className="px-3 py-2 text-left">點數</th>
                    <th className="px-3 py-2 text-left">快速調整</th>
                    <th className="px-3 py-2 text-left">自訂</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.discord_id} className="border-t hover:bg-gray-50">
                      <td className="px-3 py-3">
                        <code className="bg-gray-100 px-2 py-1 rounded text-xs">{user.discord_id}</code>
                        <button 
                          onClick={() => navigator.clipboard.writeText(user.discord_id)} 
                          className="ml-2 text-gray-400 hover:text-gray-600"
                        >
                          📋
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-bold text-orange-600">🐟 {user.points?.toLocaleString() || 0}</span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => adjustUserPoints(user.discord_id, -10)} className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200">-10</button>
                          <button onClick={() => adjustUserPoints(user.discord_id, -1)} className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200">-1</button>
                          <button onClick={() => adjustUserPoints(user.discord_id, 1)} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200">+1</button>
                          <button onClick={() => adjustUserPoints(user.discord_id, 10)} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200">+10</button>
                          <button onClick={() => adjustUserPoints(user.discord_id, 100)} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200">+100</button>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1 items-center">
                          <input
                            type="number"
                            placeholder="點數"
                            className="w-20 px-2 py-1 border rounded text-xs"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                setUserPoints(user.discord_id, e.target.value)
                                e.target.value = ''
                              }
                            }}
                          />
                          <button 
                            onClick={(e) => {
                              const input = e.target.previousSibling
                              if (input.value) {
                                setUserPoints(user.discord_id, input.value)
                                input.value = ''
                              }
                            }}
                            className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200"
                          >
                            設定
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {users.length === 0 && (
              <p className="text-gray-500 text-center py-8">沒有找到用戶</p>
            )}
          </div>
        )}

        {/* 中獎通知與紀錄 */}
        {activeTab === 'notifications' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            {/* 子分頁選擇 */}
            <div className="flex gap-2 mb-6 flex-wrap">
              <button 
                onClick={() => setRecordTab('notifications')} 
                className={`px-4 py-2 rounded-lg font-medium transition ${recordTab === 'notifications' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                🔔 中獎通知 ({notifications.length})
              </button>
              <button 
                onClick={() => setRecordTab('draws')} 
                className={`px-4 py-2 rounded-lg font-medium transition ${recordTab === 'draws' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                🎰 福引紀錄 ({drawRecords.length})
              </button>
              <button 
                onClick={() => setRecordTab('redemptions')} 
                className={`px-4 py-2 rounded-lg font-medium transition ${recordTab === 'redemptions' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                🎁 兌換紀錄 ({redemptionRecords.length})
              </button>
              <button 
                onClick={() => setRecordTab('codes')} 
                className={`px-4 py-2 rounded-lg font-medium transition ${recordTab === 'codes' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                🎫 兌換碼紀錄 ({codeRedemptions.length})
              </button>
              <button 
                onClick={loadAllRecords} 
                className="ml-auto text-sm text-orange-500 hover:text-orange-700"
              >
                🔄 重新整理全部
              </button>
            </div>

            {/* 中獎通知列表 */}
            {recordTab === 'notifications' && (
              <>
                {notifications.length === 0 ? <p className="text-gray-500 text-center py-8">目前沒有中獎通知</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left">類型</th>
                          <th className="px-3 py-2 text-left">用戶名稱</th>
                          <th className="px-3 py-2 text-left">Discord ID</th>
                          <th className="px-3 py-2 text-left">獎品</th>
                          <th className="px-3 py-2 text-left">時間</th>
                          <th className="px-3 py-2 text-left">狀態</th>
                          <th className="px-3 py-2 text-left">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {notifications.map((n) => (
                          <tr key={n.id} className="border-t hover:bg-gray-50">
                            <td className="px-3 py-3">
                              <span className="text-2xl">
                                {n.item_type === 'reward' ? '🎁' : n.item_type === 'gacha' ? '🎰' : n.item_type === 'gacha_multi' ? '🎊' : '📦'}
                              </span>
                            </td>
                            <td className="px-3 py-3 font-medium">{n.discord_name}</td>
                            <td className="px-3 py-3">
                              <code className="bg-gray-100 px-2 py-1 rounded text-xs">{n.discord_id}</code>
                              <button onClick={() => navigator.clipboard.writeText(n.discord_id)} className="ml-2 text-gray-400 hover:text-gray-600" title="複製 ID">📋</button>
                            </td>
                            <td className="px-3 py-3">{n.item_name}</td>
                            <td className="px-3 py-3 text-gray-500">{new Date(n.created_at).toLocaleString('zh-TW')}</td>
                            <td className="px-3 py-3">
                              <span className={`px-2 py-1 rounded text-xs ${n.notified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                {n.notified ? '已處理' : '待處理'}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex gap-2">
                                <button onClick={() => toggleNotificationStatus(n)} className={`text-xs px-2 py-1 rounded ${n.notified ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' : 'bg-green-100 text-green-800 hover:bg-green-200'}`}>
                                  {n.notified ? '標記待處理' : '標記已處理'}
                                </button>
                                <button onClick={() => deleteNotification(n.id)} className="text-xs px-2 py-1 rounded bg-red-100 text-red-800 hover:bg-red-200">刪除</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {/* 統計資訊 */}
                <div className="mt-6 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-yellow-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-yellow-600">{notifications.filter(n => !n.notified).length}</p>
                    <p className="text-sm text-gray-600">待處理</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-green-600">{notifications.filter(n => n.notified).length}</p>
                    <p className="text-sm text-gray-600">已處理</p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-orange-600">{notifications.filter(n => n.item_type === 'reward').length}</p>
                    <p className="text-sm text-gray-600">兌換獎品</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-purple-600">{notifications.filter(n => n.item_type?.includes('gacha')).length}</p>
                    <p className="text-sm text-gray-600">福引中獎</p>
                  </div>
                </div>
              </>
            )}

            {/* 福引抽獎紀錄 */}
            {recordTab === 'draws' && (
              <>
                {drawRecords.length === 0 ? <p className="text-gray-500 text-center py-8">目前沒有福引紀錄</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left">Discord ID</th>
                          <th className="px-3 py-2 text-left">抽獎結果</th>
                          <th className="px-3 py-2 text-left">抽數</th>
                          <th className="px-3 py-2 text-left">時間</th>
                        </tr>
                      </thead>
                      <tbody>
                        {drawRecords.map((d) => (
                          <tr key={d.id} className={`border-t hover:bg-gray-50 ${d.prize_won && !d.prize_won.includes('銘謝') ? 'bg-yellow-50' : ''}`}>
                            <td className="px-3 py-3">
                              <code className="bg-gray-100 px-2 py-1 rounded text-xs">{d.discord_id}</code>
                              <button onClick={() => navigator.clipboard.writeText(d.discord_id)} className="ml-2 text-gray-400 hover:text-gray-600" title="複製 ID">📋</button>
                            </td>
                            <td className="px-3 py-3">
                              <span className={`${d.prize_won && !d.prize_won.includes('銘謝') ? 'text-yellow-700 font-bold' : 'text-gray-500'}`}>
                                {d.prize_won || '未知'}
                              </span>
                            </td>
                            <td className="px-3 py-3">{d.draws}</td>
                            <td className="px-3 py-3 text-gray-500">{new Date(d.created_at).toLocaleString('zh-TW')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {/* 統計 */}
                <div className="mt-6 pt-4 border-t grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-blue-600">{drawRecords.length}</p>
                    <p className="text-sm text-gray-600">總抽獎次數</p>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-yellow-600">{drawRecords.filter(d => d.prize_won && !d.prize_won.includes('銘謝')).length}</p>
                    <p className="text-sm text-gray-600">中獎次數</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-gray-600">{drawRecords.filter(d => d.prize_won?.includes('銘謝')).length}</p>
                    <p className="text-sm text-gray-600">銘謝惠顧</p>
                  </div>
                </div>
              </>
            )}

            {/* 獎品兌換紀錄 */}
            {recordTab === 'redemptions' && (
              <>
                {redemptionRecords.length === 0 ? <p className="text-gray-500 text-center py-8">目前沒有兌換紀錄</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left">Discord ID</th>
                          <th className="px-3 py-2 text-left">獎品名稱</th>
                          <th className="px-3 py-2 text-left">花費點數</th>
                          <th className="px-3 py-2 text-left">配送方式</th>
                          <th className="px-3 py-2 text-left">時間</th>
                        </tr>
                      </thead>
                      <tbody>
                        {redemptionRecords.map((r) => (
                          <tr key={r.id} className="border-t hover:bg-gray-50">
                            <td className="px-3 py-3">
                              <code className="bg-gray-100 px-2 py-1 rounded text-xs">{r.discord_id}</code>
                              <button onClick={() => navigator.clipboard.writeText(r.discord_id)} className="ml-2 text-gray-400 hover:text-gray-600" title="複製 ID">📋</button>
                            </td>
                            <td className="px-3 py-3 font-medium">{r.item_name}</td>
                            <td className="px-3 py-3">🐟 {r.points_spent}</td>
                            <td className="px-3 py-3">
                              <span className={`px-2 py-1 rounded text-xs ${r.delivery_method === 'convenience_store' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                                {r.delivery_method === 'convenience_store' ? '賣貨便' : '郵寄'}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-gray-500">{new Date(r.created_at).toLocaleString('zh-TW')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {/* 統計 */}
                <div className="mt-6 pt-4 border-t grid grid-cols-2 gap-4">
                  <div className="bg-orange-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-orange-600">{redemptionRecords.length}</p>
                    <p className="text-sm text-gray-600">總兌換次數</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-blue-600">{redemptionRecords.reduce((sum, r) => sum + (r.points_spent || 0), 0)}</p>
                    <p className="text-sm text-gray-600">總花費點數</p>
                  </div>
                </div>
              </>
            )}

            {/* 兌換碼使用紀錄 */}
            {recordTab === 'codes' && (
              <>
                {codeRedemptions.length === 0 ? <p className="text-gray-500 text-center py-8">目前沒有兌換碼使用紀錄</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left">Discord ID</th>
                          <th className="px-3 py-2 text-left">兌換碼</th>
                          <th className="px-3 py-2 text-left">獲得點數</th>
                          <th className="px-3 py-2 text-left">說明</th>
                          <th className="px-3 py-2 text-left">兌換時間</th>
                        </tr>
                      </thead>
                      <tbody>
                        {codeRedemptions.map((c) => (
                          <tr key={c.id} className="border-t hover:bg-gray-50">
                            <td className="px-3 py-3">
                              <code className="bg-gray-100 px-2 py-1 rounded text-xs">{c.discord_id}</code>
                              <button onClick={() => navigator.clipboard.writeText(c.discord_id)} className="ml-2 text-gray-400 hover:text-gray-600" title="複製 ID">📋</button>
                            </td>
                            <td className="px-3 py-3">
                              <code className="bg-purple-100 text-purple-800 px-2 py-1 rounded font-mono">{c.exchange_codes?.code || '未知'}</code>
                            </td>
                            <td className="px-3 py-3 font-medium text-green-600">+{c.exchange_codes?.points || 0} 🐟</td>
                            <td className="px-3 py-3 text-gray-500">{c.exchange_codes?.description || '-'}</td>
                            <td className="px-3 py-3 text-gray-500">{new Date(c.redeemed_at).toLocaleString('zh-TW')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {/* 統計 */}
                <div className="mt-6 pt-4 border-t grid grid-cols-2 gap-4">
                  <div className="bg-purple-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-purple-600">{codeRedemptions.length}</p>
                    <p className="text-sm text-gray-600">總兌換次數</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-green-600">{codeRedemptions.reduce((sum, c) => sum + (c.exchange_codes?.points || 0), 0)}</p>
                    <p className="text-sm text-gray-600">總發放點數</p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
