import { Modal, Image } from 'antd'
import type { DisposalTask } from './TaskDetailModal'

interface DisposalViewModalProps {
  open: boolean
  task: DisposalTask | null
  onClose: () => void
}

export default function DisposalViewModal({ open, task, onClose }: DisposalViewModalProps) {
  return (
    <Modal
      title={<span className="text-[#03FBFD] font-bold">查看处置</span>}
      open={open}
      onCancel={onClose}
      width={600}
      footer={null}
      styles={{ body: { padding: '20px 24px' } }}
    >
      {task && (
        <div className="space-y-4">
          <div>
            <span className="text-[#03FBFD] block mb-2">处置内容</span>
            <div
              className="p-3 rounded text-white/75"
              style={{ backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(3,251,253,0.15)' }}
            >
              {task.disposalContent}
            </div>
          </div>
          {task.photos && task.photos.length > 0 && (
            <div>
              <span className="text-[#03FBFD] block mb-2">现场照片</span>
              <div className="flex gap-3 flex-wrap">
                {task.photos.map((url, i) => (
                  <Image
                    key={i}
                    src={url}
                    width={80}
                    height={80}
                    style={{ objectFit: 'cover', borderRadius: 4, border: '1px solid rgba(3,251,253,0.2)' }}
                  />
                ))}
              </div>
            </div>
          )}
          {task.completedAt && (
            <div className="flex justify-between">
              <span className="text-[#03FBFD]">完成时间</span>
              <span className="text-white/75">{task.completedAt}</span>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
