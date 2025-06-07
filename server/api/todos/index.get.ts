import prisma from '~/lib/prisma'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const todoColumnId = query.todoColumnId as string | undefined
    
    const todos = await prisma.todo.findMany({
      where: todoColumnId ? { todoColumnId } : undefined,
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
      },
      orderBy: [
        { todoColumnId: 'asc' },
        { completed: 'asc' },
        { order: 'asc' }
      ]
    })
    
    return todos
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch todos'
    })
  }
}) 