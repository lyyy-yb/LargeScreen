import { useEffect, useState } from 'react'
import { App, Button, Image, Input, Upload } from 'antd'
import type { UploadFile } from 'antd'
import { DeleteOutlined, PictureOutlined } from '@ant-design/icons'
import AuthenticatedImage from './AuthenticatedImage'
import { isEvidenceMedia, isEvidenceVideo } from '../data/evidenceMedia'

export interface EvidenceUploadFile extends UploadFile { caption?: string; serverId?: string | number; filePath?: string }
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024

function PreviewImage({ file }: { file: EvidenceUploadFile }) {
  const [localUrl, setLocalUrl] = useState('')
  useEffect(() => {
    if (!file.originFileObj) return
    const url = URL.createObjectURL(file.originFileObj)
    let active = true
    queueMicrotask(() => { if (active) setLocalUrl(url) })
    return () => { active = false; URL.revokeObjectURL(url) }
  }, [file.originFileObj])
  const url = file.url || localUrl
  return file.serverId != null ? <AuthenticatedImage id={file.serverId} name={file.name} source="evidence" />
    : url ? isEvidenceVideo(file) ? <video className="evidence-video" src={url} controls preload="metadata" aria-label={file.name} /> : <Image src={url} alt={file.name} width="100%" /> : null
}

export default function EvidenceImages({ files, onChange, title = '点击或拖拽上传图片或 MP4 视频', hint = '支持所有图片格式和 MP4，单个不超过 10 MB，最多 9 个', disabled = false, captions = false }: {
  files: EvidenceUploadFile[]
  onChange: (files: EvidenceUploadFile[]) => void
  title?: string
  hint?: string
  disabled?: boolean
  captions?: boolean
}) {
  const { message } = App.useApp()
  return <div className="evidence-images">
    <Upload.Dragger accept="image/*,video/mp4,.mp4,.heic,.heif,.tif,.tiff" multiple disabled={disabled} fileList={files} showUploadList={false}
      beforeUpload={file => {
        if (!isEvidenceMedia(file)) { message.warning('请选择图片或 MP4 视频'); return Upload.LIST_IGNORE }
        if (file.size > MAX_IMAGE_BYTES) { message.warning('单个文件不能超过 10 MB'); return Upload.LIST_IGNORE }
        return false
      }}
      onChange={({ fileList }) => {
        if (fileList.length > 9) message.warning('每组最多上传 9 个文件')
        onChange(fileList.slice(0, 9).map(file => ({ ...files.find(item => item.uid === file.uid), ...file })))
      }}>
      <PictureOutlined className="evidence-upload-icon" />
      <p className="evidence-upload-title">{title}</p><p className="evidence-muted">{hint}</p>
    </Upload.Dragger>
    <Image.PreviewGroup>
      {files.map(file => <figure className="evidence-figure" key={file.uid}>
        <PreviewImage file={file} />
        <Button className="evidence-remove" danger size="small" icon={<DeleteOutlined />} disabled={disabled}
          aria-label={`移除 ${file.name}`} onClick={() => onChange(files.filter(item => item.uid !== file.uid))} />
        {captions ? <Input aria-label={`${file.name} 图片说明`} placeholder="请输入图片说明（可选）" value={file.caption}
          disabled={disabled} maxLength={200} onChange={e => onChange(files.map(item => item.uid === file.uid ? { ...item, caption: e.target.value } : item))} />
          : <figcaption>{file.name}</figcaption>}
      </figure>)}
    </Image.PreviewGroup>
  </div>
}
