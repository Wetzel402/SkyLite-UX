import prisma from '~/lib/prisma'

export default defineEventHandler(async (event) => {
  try {
    const userId = getRouterParam(event, 'id')
    
    if (!userId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'User ID is required'
      })
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        todoColumn: {
          include: {
            todos: true
          }
        }
      }
    })

    if (!existingUser) {
      throw createError({
        statusCode: 404,
        statusMessage: 'User not found'
      })
    }

    // Delete user and associated todo column in a transaction
    await prisma.$transaction(async (tx) => {
      // If the user has a todo column with todos, we need to handle them
      if (existingUser.todoColumn && existingUser.todoColumn.todos.length > 0) {
        // Find or create an "Unassigned" column to move the todos to
        let unassignedColumn = await tx.todoColumn.findFirst({
          where: { isDefault: true }
        })

        if (!unassignedColumn) {
          // Create an unassigned column if it doesn't exist
          unassignedColumn = await tx.todoColumn.create({
            data: {
              name: 'Unassigned',
              isDefault: true,
              order: 0
            }
          })
        }

        // Move all todos from the user's column to the unassigned column
        await tx.todo.updateMany({
          where: { todoColumnId: existingUser.todoColumn.id },
          data: { todoColumnId: unassignedColumn.id }
        })
      }

      // Delete the user's todo column (if exists)
      if (existingUser.todoColumn) {
        await tx.todoColumn.delete({
          where: { id: existingUser.todoColumn.id }
        })
      }

      // Delete the user
      await tx.user.delete({
        where: { id: userId }
      })
    })

    return { success: true }
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to delete user'
    })
  }
}) 