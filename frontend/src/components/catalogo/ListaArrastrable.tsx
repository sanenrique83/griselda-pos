'use client'

import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'

// Lista reordenable por arrastre construida solo con @dnd-kit/core (sin el
// paquete /sortable, que no está instalado en el proyecto): cada fila es a
// la vez draggable y droppable con el mismo id; al soltar, se intercambian
// posiciones por índice (como en mapa-mesas, mismo par de sensores).
interface ListaArrastrableProps<T extends { id: number }> {
  items: T[]
  onReorder: (nuevoOrden: T[]) => void
  renderItem: (item: T, dragHandleProps: Record<string, unknown>) => React.ReactNode
}

export function ListaArrastrable<T extends { id: number }>({
  items,
  onReorder,
  renderItem,
}: ListaArrastrableProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((i) => String(i.id) === String(active.id))
    const newIndex = items.findIndex((i) => String(i.id) === String(over.id))
    if (oldIndex === -1 || newIndex === -1) return
    const next = [...items]
    const [moved] = next.splice(oldIndex, 1)
    next.splice(newIndex, 0, moved)
    onReorder(next)
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      {items.map((item) => (
        <FilaArrastrable key={item.id} id={item.id}>
          {(dragHandleProps) => renderItem(item, dragHandleProps)}
        </FilaArrastrable>
      ))}
    </DndContext>
  )
}

function FilaArrastrable({
  id,
  children,
}: {
  id: number
  children: (dragHandleProps: Record<string, unknown>) => React.ReactNode
}) {
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: String(id),
  })
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: String(id) })

  return (
    <div
      ref={(node) => {
        setDragRef(node)
        setDropRef(node)
      }}
      style={{
        transform: transform ? `translate3d(0, ${transform.y}px, 0)` : undefined,
        position: 'relative',
        zIndex: isDragging ? 10 : undefined,
        opacity: isDragging ? 0.5 : 1,
        backgroundColor: isOver ? 'rgba(23, 63, 46, 0.06)' : undefined,
      }}
    >
      {children({ ...attributes, ...listeners })}
    </div>
  )
}
