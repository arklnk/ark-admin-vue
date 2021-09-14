import { isEmpty, isFunction } from 'lodash'
import store from '@/store'
import { getToken } from '../../utils/auth'

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
  /**
   * socket.io-client reserved event keywords
   * @type {string[]}
   */
  static staticEvents = [
    // socket instance listen
    'connect',
    'connect_error',
    'disconnect',
    'disconnecting',
    'newListener',
    'removeListener',
    // Manager listen
    'error',
    'reconnect',
    'reconnect_attempt',
    'reconnect_error',
    'reconnect_failed',
    'ping',
    'pong'
  ]

  constructor() {
    // socket io client instance
    this.socketInstance = null
    this.handleIndex = 0
    this.flushing = false
    this.waiting = false
    // is server disconnect
    this.closeByServer = false
    // init
    this._init()
  }

  /**
   * 获取当前连接的clientid
   */
  getClientId() {
    if (this.socketInstance) {
      return this.socketInstance.id
    }
    return undefined
  }

  /**
   * 获取真实的Socket连接状态
   */
  isConnected() {
    return this.socketInstance.connected
  }

  /**
   * 主动关闭连接
   */
  close() {
    if (this.socketInstance) {
      this.socketInstance.close()
    }
    this.socketInstance = null
  }

  /**
   * SocketIO 初始化
   */
  _init() {
    if (this.socketInstance && this.socketInstance.connected) {
      throw new Error('socket is connecting')
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
    this.socketInstance = new WebSocket()
    // register default event
    this.socketInstance.on(SocketWrapper.staticEvents[0], this.handleConnectEvent.bind(this))
    this.socketInstance.on(SocketWrapper.staticEvents[1], this.handleErrorEvent.bind(this))
    this.socketInstance.on(SocketWrapper.staticEvents[2], this.handleDisconnectEvent.bind(this))
    // reconnecting
    this.socketInstance.io.on(SocketWrapper.staticEvents[8], this.handleReconnectAttemptEvent.bind(this))
  }

  /**
   * on custom event
   */
  subscribe(eventName, fn) {
    if (isEmpty(eventName) || !isFunction(fn)) {
      throw new TypeError('param must correct type')
    }
    // register
    this.socketInstance.on(eventName, fn)
  }

  /**
   * off custom event
   */
  unsubscribe(eventName, fn) {
    if (isEmpty(eventName)) {
      throw new TypeError('param must correct type')
    }
    if (SocketWrapper.staticEvents.includes(eventName) && !isFunction(fn)) {
      throw new Error('default event remove must has second param')
    }
    this.socketInstance.off(eventName, fn)
  }

  /**
   * 派发事件通知Socket状态
   */
  changeStatus(status) {
    store.commit('ws/SET_STATUS', status)
  }

  /**
   * 默认事件处理
   */
  handleConnectEvent() {
    this.changeStatus(SocketStatus.CONNECTED)
    // flush queue
    if (this.emitQueue.length > 0) {
      // copy
      const queue = this.emitQueue.slice()
      // clean
      this.emitQueue = []
      for (let i = 0; i < queue.length; i++) {
        this.queueEmit(queue[i])
      }
    }
  }

  /**
   * 默认事件处理
   */
  handleReconnectAttemptEvent() {
    this.changeStatus(SocketStatus.CONNECTING)
  }

  /**
   * 默认事件处理
   */
  handleDisconnectEvent(reason) {
    if (reason === 'io server disconnect') {
      this.closeByServer = true
      this.changeStatus(SocketStatus.CLOSE)
    }
  }

  /**
   * 默认事件处理
   */
  handleErrorEvent() {
    if (this.closeByServer) {
      this.changeStatus(SocketStatus.CLOSE)
    }
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
    if (isEmpty(eventName) || SocketWrapper.staticEvents.includes(eventName)) {
      throw new TypeError('event is not allow emit')
    }
    if (this.isConnected()) {
      this.socketInstance.emit(eventName, data)
    }
  }
}
