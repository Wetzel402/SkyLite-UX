import prisma from '~/lib/prisma'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { todoId, direction, todoColumnId } = body
    
    if (!todoId || !direction) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Todo ID and direction are required'
      })
    }

    // Get the current todo
    const currentTodo = await prisma.todo.findUnique({
      where: { id: todoId }
    })

    if (!currentTodo) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Todo not found'
      })
    }

    // Get all todos for the same column in the same completion state
    const todos = await prisma.todo.findMany({
      where: {
        todoColumnId: todoColumnId || null,
        completed: currentTodo.completed
      },
      orderBy: { order: 'asc' }
    })

    // Find current position
    const currentIndex = todos.findIndex(t => t.id === todoId)
    if (currentIndex === -1) return currentTodo

    // Calculate new position
    let targetIndex
    if (direction === 'up' && currentIndex > 0) {
      targetIndex = currentIndex - 1
    } else if (direction === 'down' && currentIndex < todos.length - 1) {
      targetIndex = currentIndex + 1
    } else {
      return currentTodo // No change needed
    }

    // Simple swap: just exchange the order values of the two adjacent todos
    const targetTodo = todos[targetIndex]
    const tempOrder = currentTodo.order

    await prisma.$transaction([
      prisma.todo.update({
        where: { id: todoId },
        data: { order: targetTodo.order }
      }),
      prisma.todo.update({
        where: { id: targetTodo.id },
        data: { order: tempOrder }
      })
    ])

    // Return updated todo
    const updatedTodo = await prisma.todo.findUnique({
      where: { id: todoId },
      include: {
        todoColumn: {
          select: {
            id: true,
            name: true,
            order: true,
            isDefault: true,
            user: {
              select: {
                id: true,
                name: true,
                avatar: true
              }
            }
          }
        }
      }
    })

    return updatedTodo
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to reorder todo'
    })
  }
}) 