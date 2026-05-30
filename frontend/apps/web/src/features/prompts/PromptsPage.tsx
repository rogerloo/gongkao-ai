import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Button, Input, Modal, Select, Space, Switch, Tag } from 'antd'
import Editor, { DiffEditor } from '@monaco-editor/react'
import { addVersion, createPrompt, getPrompt, listPrompts, setCurrent } from './api'
import PromptPlayground from './PromptPlayground'
import { extractVars } from './vars'

const EDITOR_OPTS = {
  minimap: { enabled: false },
  fontSize: 13,
  wordWrap: 'on',
  scrollBeyondLastLine: false,
} as const

export default function PromptsPage() {
  const qc = useQueryClient()
  const { message } = App.useApp()
  const { data: prompts } = useQuery({ queryKey: ['prompts'], queryFn: listPrompts })

  const [activeId, setActiveId] = useState<number | null>(null)
  useEffect(() => {
    if (activeId == null && prompts && prompts.length > 0) setActiveId(prompts[0].id)
  }, [prompts, activeId])

  const { data: detail } = useQuery({
    queryKey: ['prompt', activeId],
    queryFn: () => getPrompt(activeId as number),
    enabled: activeId != null,
  })

  const [viewVersion, setViewVersion] = useState<number | null>(null)
  const [content, setContent] = useState('')
  const [compare, setCompare] = useState(false)
  const [compareVer, setCompareVer] = useState<number | null>(null)

  useEffect(() => {
    if (!detail) return
    const v =
      detail.versions.find((x) => x.version === detail.current_version) ?? detail.versions[0]
    setViewVersion(v ? v.version : null)
    setContent(v ? v.system_prompt : '')
    setCompare(false)
  }, [detail])

  const versionObj = detail?.versions.find((v) => v.version === viewVersion)
  const compareObj = detail?.versions.find((v) => v.version === compareVer)
  const dirty = versionObj ? content !== versionObj.system_prompt : content.length > 0
  const vars = extractVars(content)

  const saveMut = useMutation({
    mutationFn: () => addVersion(activeId as number, content),
    onSuccess: () => {
      message.success('已保存为新版本')
      void qc.invalidateQueries({ queryKey: ['prompt', activeId] })
      void qc.invalidateQueries({ queryKey: ['prompts'] })
    },
  })
  const rollbackMut = useMutation({
    mutationFn: (v: number) => setCurrent(activeId as number, v),
    onSuccess: () => {
      message.success('已切换当前版本')
      void qc.invalidateQueries({ queryKey: ['prompt', activeId] })
      void qc.invalidateQueries({ queryKey: ['prompts'] })
    },
  })

  const [newOpen, setNewOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const doCreate = async () => {
    const r = await createPrompt(newName.trim() || '新模板', '')
    setNewOpen(false)
    setNewName('')
    await qc.invalidateQueries({ queryKey: ['prompts'] })
    setActiveId(r.id)
  }

  const selectVersion = (v: number) => {
    setViewVersion(v)
    const vo = detail?.versions.find((x) => x.version === v)
    setContent(vo ? vo.system_prompt : '')
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <Space wrap>
        <Select
          style={{ width: 240 }}
          value={activeId ?? undefined}
          placeholder="选择 Prompt"
          options={(prompts ?? []).map((p) => ({
            value: p.id,
            label: `${p.name}(v${p.current_version})`,
          }))}
          onChange={setActiveId}
        />
        <Button onClick={() => setNewOpen(true)}>新建</Button>
        {detail && (
          <>
            <Select
              style={{ width: 140 }}
              value={viewVersion ?? undefined}
              options={detail.versions.map((v) => ({
                value: v.version,
                label: `v${v.version}${v.version === detail.current_version ? ' (当前)' : ''}`,
              }))}
              onChange={selectVersion}
            />
            <Button
              size="small"
              disabled={!viewVersion || viewVersion === detail.current_version}
              loading={rollbackMut.isPending}
              onClick={() => viewVersion && rollbackMut.mutate(viewVersion)}
            >
              设为当前
            </Button>
            <span className="text-xs text-gray-400">对比</span>
            <Switch size="small" checked={compare} onChange={setCompare} />
            {compare && (
              <Select
                style={{ width: 130 }}
                placeholder="对比版本"
                value={compareVer ?? undefined}
                options={detail.versions.map((v) => ({ value: v.version, label: `v${v.version}` }))}
                onChange={setCompareVer}
              />
            )}
          </>
        )}
      </Space>

      <div className="flex min-h-0 flex-1 gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="min-h-0 flex-1 overflow-hidden rounded border border-gray-200">
            {compare && compareObj ? (
              <DiffEditor
                height="100%"
                language="markdown"
                original={compareObj.system_prompt}
                modified={content}
                options={{ ...EDITOR_OPTS, readOnly: true, renderSideBySide: true }}
              />
            ) : (
              <Editor
                height="100%"
                language="markdown"
                value={content}
                onChange={(v) => setContent(v ?? '')}
                options={EDITOR_OPTS}
              />
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">变量:</span>
            {vars.length > 0 ? (
              vars.map((v) => <Tag key={v} color="blue" className="!mr-0">{`{{${v}}}`}</Tag>)
            ) : (
              <span className="text-xs text-gray-300">无</span>
            )}
            <span className="flex-1" />
            <Button
              type="primary"
              size="small"
              loading={saveMut.isPending}
              disabled={!activeId || !dirty}
              onClick={() => saveMut.mutate()}
            >
              保存为新版本
            </Button>
          </div>
        </div>

        <div className="w-[360px] shrink-0 border-l border-gray-200 pl-3">
          <PromptPlayground systemPrompt={content} />
        </div>
      </div>

      <Modal
        title="新建 Prompt 模板"
        open={newOpen}
        onOk={() => void doCreate()}
        onCancel={() => setNewOpen(false)}
        okText="创建"
      >
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="模板名称"
          onPressEnter={() => void doCreate()}
        />
      </Modal>
    </div>
  )
}
