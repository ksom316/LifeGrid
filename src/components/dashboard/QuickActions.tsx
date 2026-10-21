import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NoteFormModal } from '../notes/NoteFormModal'
import { ProjectFormModal } from '../projects/ProjectFormModal'
import { TaskFormModal } from '../projects/TaskFormModal'
import { useAppData } from '../../state/AppDataContext'
import { Button } from '../ui/Button'
import { IconBook, IconFolder, IconPlus, IconTimer } from '../ui/icons'

type ActiveModal = 'task' | 'project' | 'note' | null

export function QuickActions() {
  const [active, setActive] = useState<ActiveModal>(null)
  const { projects } = useAppData()
  const navigate = useNavigate()

  return (
    <>
      {/* A even 2-column grid on mobile (so four actions line up cleanly
          instead of ragged-wrapping by label width); desktop keeps the
          natural content-hugging row since there's room for it. */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Button variant="primary" icon={<IconPlus width={16} height={16} />} onClick={() => setActive('task')}>
          Add task
        </Button>
        <Button icon={<IconFolder width={16} height={16} />} onClick={() => setActive('project')}>
          Add project
        </Button>
        <Button icon={<IconBook width={16} height={16} />} onClick={() => setActive('note')}>
          Add note
        </Button>
        <Button icon={<IconTimer width={16} height={16} />} onClick={() => navigate('/focus')}>
          Start focus session
        </Button>
      </div>

      <TaskFormModal
        isOpen={active === 'task'}
        onClose={() => setActive(null)}
        projects={projects}
      />
      <ProjectFormModal isOpen={active === 'project'} onClose={() => setActive(null)} />
      <NoteFormModal
        isOpen={active === 'note'}
        onClose={() => setActive(null)}
        projects={projects}
      />
    </>
  )
}
