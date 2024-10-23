// index.js
const app = getApp()

// 在文件顶部添加这个函数
const handleError = (error, message) => {
  console.error(message, error)
  wx.hideLoading()
  wx.showToast({
    title: message,
    icon: 'none'
  })
}

// 然后在 Page 对象之前添加这行代码
wx.onError(handleError)

Page({
  data: {
    inputText: '',
    chatHistory: [],
    isWaitingForResponse: false,
    apiKey: 'pat_CV1bprcNlvIRi7HCvQz9Xv4BJT8xLl8khEyHCdp6xHWQTI6Qfc4H0AA7OE7Vp1ZZ', // 请替换为您的实际 API Key
    botId: '7379074877703569419', // 请替换为您的实际 Bot ID
    conversationId: null
  },

  onInputChange(e) {
    this.setData({
      inputText: e.detail.value
    })
  },

  sendMessage() {
    if (this.data.inputText.trim() === '' || this.data.isWaitingForResponse) {
      return
    }

    const userMessage = this.data.inputText.trim()
    const updatedChatHistory = [...this.data.chatHistory, { role: 'user', content: userMessage }]

    this.setData({
      chatHistory: updatedChatHistory,
      inputText: '',
      isWaitingForResponse: true
    })

    this.sendToCoze(userMessage)
  },

  sendToCoze(userInput) {
    const requestData = {
      bot_id: this.data.botId,
      user_id: "WeChatUser", // 可以根据需要修改
      stream: true,
      auto_save_history: true,
      additional_messages: [
        {
          role: 'user',
          content: userInput,
          content_type: 'text'
        }
      ]
    }

    if (this.data.conversationId) {
      requestData.conversation_id = this.data.conversationId
    }

    const requestTask = wx.request({
      url: 'https://api.coze.cn/v3/chat',
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.data.apiKey}`
      },
      data: requestData,
      responseType: 'arraybuffer', // 修改这里
      enableChunked: true,
      success: (res) => {
        console.log('Request success:', res);
      },
      fail: (err) => {
        console.error('API request failed:', err);
        handleError(err, 'API 请求失败');
        this.setData({ isWaitingForResponse: false });
      }
    });

    requestTask.onChunkReceived((response) => {
      console.log('Chunk received:', response);
      this.handleStreamResponse(response.data);
    });
  },

  handleStreamResponse(chunk) {
    console.log('Received chunk:', chunk);

    // 将 Uint8Array 转换为字符串
    const decoder = new TextDecoder('utf-8');
    const chunkString = decoder.decode(chunk);

    console.log('Decoded chunk:', chunkString);

    const events = chunkString.split('\n\n').filter(event => event.trim() !== '');
    
    events.forEach(event => {
      const [eventType, eventData] = event.split('\n');
      const eventName = eventType.replace('event:', '');
      let data;
      try {
        data = JSON.parse(eventData.replace('data:', ''));
      } catch (error) {
        console.error('Error parsing event data:', error);
        return;
      }

      switch (eventName) {
        case 'conversation.chat.created':
        case 'conversation.chat.in_progress':
          if (!this.data.conversationId) {
            this.setData({ conversationId: data.conversation_id });
          }
          break;
        case 'conversation.message.delta':
          if (data.role === 'assistant') {
            this.updateAssistantMessage(data);
          }
          break;
        case 'conversation.message.completed':
          // 不需要特殊处理，因为我们已经在 delta 事件中更新了消息
          break;
        case 'conversation.chat.completed':
          this.setData({ isWaitingForResponse: false });
          break;
        case 'error':
          handleError(data, '聊天过程中出错');
          this.setData({ isWaitingForResponse: false });
          break;
        case 'done':
          // ��式响应结束
          break;
        default:
          console.log('Unhandled event:', eventName, data);
      }
    });
  },

  updateAssistantMessage(messageData) {
    const chatHistory = this.data.chatHistory;
    let lastMessage = chatHistory[chatHistory.length - 1];

    if (messageData.content && typeof messageData.content === 'string') {
      // 直接使用原始内容，不进行任何处理
      const originalContent = messageData.content;

      if (lastMessage && lastMessage.role === 'assistant') {
        lastMessage.content += originalContent;
      } else {
        chatHistory.push({
          role: 'assistant',
          content: originalContent
        });
      }

      this.setData({ chatHistory });
    }
  }
})
