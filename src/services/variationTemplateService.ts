import { prisma, AppError, HttpStatus, Messages } from '../core/Service'
import type {
  CreateVariationTemplateInput,
  UpdateVariationTemplateInput,
  VariationTemplateQueryInput,
} from '../validations/variationTemplateValidation'

const includeOptions = {
  options: {
    orderBy: { displayOrder: 'asc' as const },
  },
}

export const variationTemplateService = {
  async getByShop(shopId: number, filters: VariationTemplateQueryInput) {
    const search = filters.search?.trim()
    const templates = await prisma.variationGroupTemplate.findMany({
      where: {
        shopId,
        ...(filters.includeArchived ? {} : { isActive: true }),
        ...(search
          ? {
              OR: [
                { name: { contains: search } },
                { category: { contains: search } },
                { options: { some: { optionLabel: { contains: search } } } },
              ],
            }
          : {}),
      },
      include: includeOptions,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    })

    return templates.map(this.mapTemplate)
  },

  async getById(templateId: number, shopId: number) {
    const template = await prisma.variationGroupTemplate.findFirst({
      where: { id: templateId, shopId },
      include: includeOptions,
    })

    if (!template) {
      throw new AppError(Messages.VARIATION_TEMPLATE_NOT_FOUND, HttpStatus.NOT_FOUND)
    }

    return this.mapTemplate(template)
  },

  async create(shopId: number, userId: number, data: CreateVariationTemplateInput) {
    const template = await prisma.variationGroupTemplate.create({
      data: {
        shopId,
        createdBy: userId,
        name: data.name,
        description: data.description || null,
        category: data.category,
        options: {
          create: data.options.map((option, index) => ({
            optionLabel: option.optionLabel,
            priceModifier: option.priceModifier,
            displayOrder: option.displayOrder ?? index,
          })),
        },
      },
      include: includeOptions,
    })

    return this.mapTemplate(template)
  },

  async update(templateId: number, shopId: number, data: UpdateVariationTemplateInput) {
    await this.ensureTemplate(templateId, shopId)

    const template = await prisma.$transaction(async tx => {
      if (data.options) {
        await tx.variationGroupTemplateOption.deleteMany({ where: { templateId } })
      }

      return tx.variationGroupTemplate.update({
        where: { id: templateId },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description || null }),
          ...(data.category !== undefined && { category: data.category }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
          ...(data.options && {
            options: {
              create: data.options.map((option, index) => ({
                optionLabel: option.optionLabel,
                priceModifier: option.priceModifier,
                displayOrder: option.displayOrder ?? index,
              })),
            },
          }),
        },
        include: includeOptions,
      })
    })

    return this.mapTemplate(template)
  },

  async delete(templateId: number, shopId: number, archiveOnly = false) {
    await this.ensureTemplate(templateId, shopId)

    if (archiveOnly) {
      const template = await prisma.variationGroupTemplate.update({
        where: { id: templateId },
        data: { isActive: false },
        include: includeOptions,
      })
      return this.mapTemplate(template)
    }

    await prisma.variationGroupTemplate.delete({ where: { id: templateId } })
    return { id: templateId }
  },

  async apply(templateId: number, shopId: number) {
    const template = await this.getById(templateId, shopId)

    return {
      name: template.name,
      type: 'custom',
      choices: template.options.map((option: { optionLabel: string; priceModifier: number }) => ({
        label: option.optionLabel,
        priceModifier: option.priceModifier,
      })),
    }
  },

  async ensureTemplate(templateId: number, shopId: number) {
    const template = await prisma.variationGroupTemplate.findFirst({
      where: { id: templateId, shopId },
      select: { id: true },
    })

    if (!template) {
      throw new AppError(Messages.VARIATION_TEMPLATE_NOT_FOUND, HttpStatus.NOT_FOUND)
    }
  },

  mapTemplate(template: any) {
    return {
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      createdBy: template.createdBy,
      isActive: template.isActive,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
      optionCount: template.options?.length ?? 0,
      options: (template.options || []).map((option: any) => ({
        id: option.id,
        templateId: option.templateId,
        optionLabel: option.optionLabel,
        priceModifier: Number(option.priceModifier),
        displayOrder: option.displayOrder,
        createdAt: option.createdAt,
        updatedAt: option.updatedAt,
      })),
    }
  },
}
