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
    this.reconnectInterval = 5000
    // 心跳pong检测超时间隔
    this.pongTimeout = 20000
    this.pingTimeout = 15000
    // 标志位，防止WebSocket重复初始化
    this.lockReconnect = false
    this.pongTimeoutID = null
    this.pingTimeoutID = null
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
   * 尝试重连
   */
  tryReconnect() {
    if (this.closeByServer || this.lockReconnect) {
      return
    }
    this.lockReconnect = true
    // 延迟执行，避免不断重复
    setTimeout(() => {
      this._initSocket()
      this.lockReconnect = false
    }, this.reconnectInterval)
  }

  /**
   * 发送一次心跳检测 (ping)
   */
  startHeartbeatDetection() {
    // 确保重置之前的任务
    clearTimeout(this.pingTimeoutID)
    clearTimeout(this.pongTimeoutID)
    // 如果服务端主动关闭，则不再启动心跳
    if (this.closeByServer) {
      return
    }
    this.pingTimeoutID = setTimeout(() => {
      if (this.socketInstance.readyState === WebSocket.OPEN) {
        // send ping event
        this.emit('ping')
      }
      this.pongTimeoutID = setTimeout(() => {
        // 如果超过该时间延时器并未清空时，则代表pong消息发送超时，则主动开始尝试重连
        this.socketInstance.close()
      }, this.pongTimeout)
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
    this.startHeartbeatDetection()
  }

  /**
   * 当通过 WebSocket 收到数据时触发
   * @param {*} e event
   */
  handleMessageEvent(e) {
    const { event, data } = JSON.parse(e.data)
    if (event === 'pong') {
      // 收到pong消息则清掉该延时任务
      clearTimeout(this.pongTimeoutID)
      // 并重新发送一次心跳
      this.startHeartbeatDetection()
      return
    } else if (event === 'close') {
      // 服务端主动关闭时，则设置，并不再主动重连
      this.closeByServer = true
    }
    this.emitter.emit(event, data)
  }

  /**
   * 当一个 WebSocket 连接被关闭时触发
   */
  handleCloseEvent() {
    this.changeStatus(SocketStatus.CLOSE)
    this.tryReconnect()
  }

  /**
   * 当一个 WebSocket 连接因错误而关闭时触发，例如无法发送数据时
   */
  handleErrorEvent() {
    // error
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
