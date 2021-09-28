import { EVENT_KICK } from '@/core/socket/event-type'
import { SocketWrapper, SocketStatus } from '@/core/socket/socket-wrapper'
import { MessageBox } from 'element-ui'

const state = {
  // socket wrapper 实例
  client: null,
  // socket 连接状态
  status: SocketStatus.CLOSE
}

const mutations = {
  SET_CLIENT(state, client) {
    state.client = client
  },
  SET_STATUS(state, status) {
    if (state.status === status) {
      return
    }
    state.status = status
  }
}

const actions = {
  // 初始化Socket
  initSocket({ commit, state, dispatch }) {
    // check is init
    if (state.client) {
      return
    }
    // 初始化ws
    const ws = new SocketWrapper()
    // 全局注册kick事件
    ws.subscribe(EVENT_KICK, async() => {
      // reset token
      await dispatch('user/resetToken', null, { root: true })
      // 关闭socket连接
      dispatch('closeSocket')
      // 消息提示，并刷新页面
      MessageBox.confirm(`您已被管理员踢下线！`, '警告', {
        confirmButtonText: '重新登录',
        cancelButtonText: '取消',
        type: 'warning'
      }).finally(() => {
        // 刷新页面
        window.location.reload()
      })
    })
    commit('SET_CLIENT', ws)
  },

  // 关闭Socket连接
  closeSocket({ commit, state }) {
    state.client && state.client.close()
    commit('SET_CLIENT', null)
  }
}

export default {
  namespaced: true,
  state,
  mutations,
  actions
}
