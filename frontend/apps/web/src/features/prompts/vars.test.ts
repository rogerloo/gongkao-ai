import { describe, expect, it } from 'vitest'
import { extractVars, renderPrompt } from './vars'

describe('prompt 变量', () => {
  it('抽取去重的变量名', () => {
    expect(extractVars('你是{{role}},语气{{tone}},再次{{role}}')).toEqual(['role', 'tone'])
    expect(extractVars('无变量')).toEqual([])
  })

  it('渲染已提供的值,缺失变量保留占位', () => {
    expect(renderPrompt('你是{{role}}', { role: '面试教练' })).toBe('你是面试教练')
    expect(renderPrompt('你是{{role}}', {})).toBe('你是{{role}}')
  })
})
