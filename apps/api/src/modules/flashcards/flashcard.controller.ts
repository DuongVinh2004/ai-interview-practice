import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FlashcardService } from './flashcard.service';
import {
  CreateDeckRequestSchema,
  UpdateDeckRequestSchema,
  CreateFlashcardRequestSchema,
  ReviewCardRequestSchema,
  AutoGenerateFlashcardsRequestSchema,
} from '@ai-interview/contracts';

@Controller('flashcards')
@UseGuards(JwtAuthGuard)
export class FlashcardController {
  constructor(private readonly flashcardService: FlashcardService) {}

  @Get('decks')
  async getUserDecks(@CurrentUser('sub') userId: string) {
    return this.flashcardService.getUserDecks(userId);
  }

  @Post('decks')
  async createDeck(@CurrentUser('sub') userId: string, @Body() body: unknown) {
    const parsed = CreateDeckRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.errors[0]?.message || 'Invalid deck payload');
    }
    return this.flashcardService.createDeck(userId, parsed.data);
  }

  @Put('decks/:id')
  async updateDeck(
    @CurrentUser('sub') userId: string,
    @Param('id') deckId: string,
    @Body() body: unknown,
  ) {
    const parsed = UpdateDeckRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.errors[0]?.message || 'Invalid update payload');
    }
    return this.flashcardService.updateDeck(userId, deckId, parsed.data);
  }

  @Delete('decks/:id')
  async deleteDeck(@CurrentUser('sub') userId: string, @Param('id') deckId: string) {
    return this.flashcardService.deleteDeck(userId, deckId);
  }

  @Get('decks/:id/cards')
  async getDeckCards(
    @CurrentUser('sub') userId: string,
    @Param('id') deckId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.flashcardService.getDeckCards(
      userId,
      deckId,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @Post('decks/:id/cards')
  async createFlashcard(
    @CurrentUser('sub') userId: string,
    @Param('id') deckId: string,
    @Body() body: unknown,
  ) {
    const payload = typeof body === 'object' && body !== null ? body : {};
    const parsed = CreateFlashcardRequestSchema.safeParse({ ...payload, deckId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.errors[0]?.message || 'Invalid card payload');
    }
    return this.flashcardService.createFlashcard(userId, parsed.data);
  }

  @Get('due')
  async getDueCards(@CurrentUser('sub') userId: string, @Query('limit') limit = '50') {
    return this.flashcardService.getDueCards(userId, parseInt(limit, 10));
  }

  @Post(':id/review')
  async reviewCard(
    @CurrentUser('sub') userId: string,
    @Param('id') cardId: string,
    @Body() body: unknown,
  ) {
    const parsed = ReviewCardRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.errors[0]?.message || 'Invalid review payload');
    }
    return this.flashcardService.reviewCard(userId, cardId, parsed.data);
  }

  @Post('auto-generate')
  async autoGenerate(@CurrentUser('sub') userId: string, @Body() body: unknown) {
    const parsed = AutoGenerateFlashcardsRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.errors[0]?.message || 'Invalid auto-generate payload',
      );
    }
    return this.flashcardService.autoGenerateFlashcards(userId, parsed.data);
  }

  @Get('stats')
  async getStats(@CurrentUser('sub') userId: string) {
    return this.flashcardService.getStats(userId);
  }
}
