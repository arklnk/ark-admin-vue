<template>
  <form-dialog ref="formDialog">
    <template #slot-status="{ scope }">
      <el-radio-group v-model="scope.status">
        <el-radio :label="1">运行</el-radio>
        <el-radio :label="0">停止</el-radio>
      </el-radio-group>
    </template>
    <template #slot-node="{ scope }">
      <el-select v-model="scope.node.nodeId" placeholder="请选择" :style="{ width: '100%' }">
        <el-option
          v-for="item in scope.node.list"
          :key="item.id"
          :label="item.name"
          :value="item.id"
        />
      </el-select>
    </template>
  </form-dialog>
</template>

<script>
import { isNumber } from 'lodash'

export default {
  name: 'SystemScheduleTaskFormDialog',
  methods: {
    async handleOpen(updateId, form, { showLoading, hideLoading, close, rebind }
    ) {
      try {
        showLoading()
        const { data: nodeList } = await this.$api.sys.task.node()
        if (updateId !== -1) {
          const { data } = await this.$api.sys.task.info({ id: updateId })
          data.node = { list: nodeList, nodeId: data.nodeId }
          rebind(data)
        } else {
          form.node.list = nodeList
        }
        hideLoading()
      } catch (e) {
        close()
      }
    },
    handleSubmit(updateId, data, { close, done }) {
      let req = null

      // 处理node
      data.nodeId = data.node.nodeId
      delete data.node

      if (updateId === -1) {
        // create
        req = this.$api.sys.task.add(data)
      } else {
        data.id = updateId
        req = this.$api.sys.task.update(data)
      }
      req
        .then(_ => {
          this.$emit('save-success')
          close()
        })
        .catch(() => {
          done()
        })
    },
    open(updateId = -1) {
      if (!isNumber(updateId)) {
        throw new Error('task id must be a number')
      }
      this.$refs.formDialog.open({
        title: '编辑任务',
        dialogProps: {
          top: '5vh'
        },
        on: {
          open: (form, op) => {
            this.handleOpen(updateId, form, op)
          },
          submit: (data, op) => {
            this.handleSubmit(updateId, data, op)
          }
        },
        items: [
          {
            label: '任务名称',
            prop: 'title',
            value: '',
            rules: {
              required: true,
              message: '请输入任务名称',
              trigger: 'blur'
            },
            component: {
              name: 'el-input',
              attrs: {
                placeholder: '请输入任务名称'
              }
            }
          },
          {
            label: '服务路径',
            prop: 'execute',
            value: '',
            rules: {
              required: true,
              message: '请输入调用服务的路径',
              trigger: 'blur'
            },
            component: {
              name: 'el-input',
              attrs: {
                placeholder: '请输入调用服务的路径'
              }
            }
          },
          {
            label: '任务参数',
            prop: 'params',
            value: '[]',
            component: {
              name: 'el-input',
              attrs: {
                placeholder: '没有参数时默认为[]'
              }
            }
          },
          {
            label: 'Cron',
            prop: 'rule',
            value: '',
            rules: {
              required: true,
              message: '请输入Cron表达式',
              trigger: 'blur'
            },
            component: {
              name: 'el-input',
              attrs: {
                placeholder: '请输入Cron表达式'
              }
            }
          },
          {
            label: '开始日期',
            prop: 'startAt',
            value: '',
            component: {
              name: 'el-date-picker',
              props: {
                type: 'datetime',
                valueFormat: 'yyyy-MM-dd HH:mm:ss'
              },
              style: {
                width: '100%'
              },
              attrs: {
                placeholder: '请选择开始日期'
              }
            }
          },
          {
            label: '结束日期',
            prop: 'lastAt',
            value: '',
            component: {
              name: 'el-date-picker',
              props: {
                type: 'datetime',
                valueFormat: 'yyyy-MM-dd HH:mm:ss'
              },
              style: {
                width: '100%'
              },
              attrs: {
                placeholder: '请选择结束日期'
              }
            }
          },
          {
            label: '单例',
            prop: 'singleton',
            value: true,
            component: {
              name: 'el-switch'
            }
          },
          {
            label: '单节点',
            prop: 'onOneServer',
            value: true,
            component: {
              name: 'el-switch'
            }
          },
          {
            label: '执行节点',
            prop: 'node',
            rules: {
              required: true,
              trigger: 'blur',
              validator: (rule, value, callback) => {
                if (!value.nodeId || !isNumber(value.nodeId)) {
                  callback(new Error('请选择执行节点'))
                } else {
                  callback()
                }
              }
            },
            value: { list: [], nodeId: null },
            component: 'slot-node'
          },
          {
            label: '备注',
            prop: 'remark',
            value: '',
            component: {
              name: 'el-input',
              props: {
                type: 'textarea',
                rows: 2
              }
            }
          },
          {
            label: '状态',
            prop: 'status',
            value: 1,
            component: 'slot-status'
          }
        ]
      })
    }
  }
}
</script>
