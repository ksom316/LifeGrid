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
      <div className="flex flex-wrap gap-2">
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
