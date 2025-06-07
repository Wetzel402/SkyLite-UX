import prisma from '~/lib/prisma'

export default defineEventHandler(async (event) => {
  try {
    const todoColumns = await prisma.todoColumn.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true
          }
        },
        todos: {
          orderBy: {
            order: 'asc'
          }
        },
        _count: {
          select: { todos: true }
        }
      },
      orderBy: {
        order: 'asc'
      }
    })
    
    return todoColumns
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch todo columns'
    })
  }
}) 