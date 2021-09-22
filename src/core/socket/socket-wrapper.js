import { isEmpty, isFunction } from 'lodash'
import store from '@/store'
import { getToken } from '../../utils/auth'
import mitt from 'mitt'

/**
 * Socket连接状态
 */
export const SocketStatus = {
  // 连接中
  CONNECTING: 'CONNECTING',
  // 已连接
  CONNECTED: 'CONNECTED',
  // 已关闭
  CLOSE: 'CLOSE'
}

export class SocketWrapper {
  constructor() {
    // socket io client instance
    this.socketInstance = null
    // is server disconnect
    this.closeByServer = false
    // 心跳ping间隔
    this.heartbeatInterval = 10000
    // 心跳pong检测超时间隔
    this.pongInterval = 30000
    // 上一次发送心跳的毫秒数
    this.lastPingTime = 0
    this.lastPongTime = 0
    // event emitter
    this.emitter = mitt()
    // init
    this._initSocket()
  }

  /**
   * 获取真实的Socket连接状态
   */
  isConnected() {
    if (this.socketInstance) {
      // https://developer.mozilla.org/zh-CN/docs/Web/API/WebSocket/readyState
      return this.socketInstance.readyState === WebSocket.OPEN
    }
    return false
  }

  /**
   * 客户端主动关闭连接
   */
  close() {
    if (this.socketInstance) {
      this.socketInstance.close()
    }
    this.socketInstance = null
  }

  /**
   * Socket 初始化
   */
  _initSocket() {
    if (this.socketInstance && this.isConnected()) {
      return
    }
    // auth token
    const token = getToken()
    if (isEmpty(token)) {
      // 未登录状态则直接关闭连接
      this.close()
      return
    }
    this.changeStatus(SocketStatus.CONNECTING)
    // 初始化SocketIO实例
    this.socketInstance = new WebSocket(
      `ws://${location.host}${process.env.VUE_APP_BASE_SOCKET_PATH}`,
      [token]
    )
    // 注册事件
    this.socketInstance.addEventListener(
      'open',
      this.handleOpenEvent.bind(this)
    )
    this.socketInstance.addEventListener(
      'close',
      this.handleCloseEvent.bind(this)
    )
    this.socketInstance.addEventListener(
      'message',
      this.handleMessageEvent.bind(this)
    )
    this.socketInstance.addEventListener(
      'error',
      this.handleErrorEvent.bind(this)
    )
  }

  /**
   * 心跳检测
   */
  _initHeartbeatDetection() {
    // 已存在ID先清除
    if (this.heartbeatTimerID) {
      clearInterval(this.heartbeatTimerID)
    }
    // 心跳保活，定时发送ping事件
    this.heartbeatTimerID = setInterval(() => {
      if (this.socketInstance.readyState === WebSocket.OPEN) {
        // send ping event
        this.emit('ping')
        // 记录当前ping
        this.lastPingTime = new Date().getTime()
      }
    }, this.heartbeatInterval)
  }

  /**
   * on custom event
   */
  subscribe(eventName, fn) {
    if (isEmpty(eventName) || !isFunction(fn)) {
      throw new TypeError('param must correct type')
    }
    // register
    this.emitter.on(eventName, fn)
  }

  /**
   * off custom event
   */
  unsubscribe(eventName, fn) {
    if (isEmpty(eventName)) {
      // 如果event为空则清除所有注册的事件
      this.emitter.all.clear()
      return
    }
    // 如果fn为空则会清除所有已经关联的注册事件
    this.emitter.off(eventName, fn)
  }

  /**
   * 派发事件通知Socket状态
   */
  changeStatus(status) {
    store.commit('ws/SET_STATUS', status)
  }

  /**
   * 当一个 WebSocket 连接成功时触发
   */
  handleOpenEvent() {
    this.changeStatus(SocketStatus.CONNECTED)
    // 连接成功后初始化心跳检测
    this._initHeartbeatDetection()
  }

  /**
   * 当通过 WebSocket 收到数据时触发
   * @param {*} e event
   */
  handleMessageEvent(e) {
    const { event, data } = JSON.parse(e.data)
    if (event === 'pong') {
      // 记录最后一次pong的时间
      this.lastPongTime = new Date().getTime()
      return
    }
    this.emitter.emit(event, data)
  }

  /**
   * 当一个 WebSocket 连接被关闭时触发
   */
  handleCloseEvent() {
    this.changeStatus(SocketStatus.CLOSE)
  }

  /**
   * 当一个 WebSocket 连接因错误而关闭时触发，例如无法发送数据时
   */
  handleErrorEvent() {
    this.changeStatus(SocketStatus.CLOSE)
  }

  /**
   * client emit
   * The following events are reserved and should not be used as event names by your application:
   * connect、connect_error、connect_timeout、error、disconnect、
   * disconnecting、newListener、reconnect_attempt、reconnecting、reconnect_error、
   * reconnect_failed、removeListener、ping、pong
   */
  emit(eventName, data) {
    // 检查event名称
    if (isEmpty(eventName)) {
      throw new TypeError('event is not allow emit')
    }
    // send
    if (this.isConnected()) {
      this.socketInstance.send(JSON.stringify({
        event: eventName,
        data
      }))
    }
  }
}
