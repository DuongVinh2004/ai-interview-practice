import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Plus, BookOpen, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { StreakHeatmap } from '../../components/flashcards/StreakHeatmap';
import { CreateCardModal } from '../../components/flashcards/CreateCardModal';
import { useFlashcards } from '../../hooks/useFlashcards';

export function FlashcardDecksPage() {
  const navigate = useNavigate();
  const {
    decks,
    isLoadingDecks,
    stats,
    createDeck,
    isCreatingDeck,
    createCard,
    isCreatingCard,
  } = useFlashcards();

  const [isCreateDeckOpen, setIsCreateDeckOpen] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');
  const [newDeckDesc, setNewDeckDesc] = useState('');
  const [activeDeckForNewCard, setActiveDeckForNewCard] = useState<string | null>(null);

  const handleCreateDeckSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeckName.trim()) return;
    await createDeck({ name: newDeckName.trim(), description: newDeckDesc.trim() || undefined, tags: [] });
    setNewDeckName('');
    setNewDeckDesc('');
    setIsCreateDeckOpen(false);
  };

  const totalDue = decks.reduce((sum, d) => sum + (d.dueCount || 0), 0);

  if (isLoadingDecks) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500">Đang tải danh sách bộ thẻ flashcards...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-4 sm:p-6" data-testid="flashcard-decks-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center space-x-2.5">
            <BookOpen className="w-8 h-8 text-emerald-600" />
            <span>Spaced Repetition Drills</span>
          </h1>
          <p className="text-slate-600 mt-1">
            Ghi nhớ dài hạn các khái niệm và câu hỏi phỏng vấn theo thuật toán FSRS v4.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {totalDue > 0 && (
            <Button
              size="lg"
              onClick={() => navigate('/flashcards/review')}
              className="bg-emerald-600 hover:bg-emerald-700 shadow-md font-bold text-sm"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              <span>Ôn tập ngay ({totalDue} thẻ)</span>
            </Button>
          )}

          <Button variant="outline" size="lg" onClick={() => setIsCreateDeckOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            <span>Tạo Bộ Thẻ Mới</span>
          </Button>
        </div>
      </div>

      {/* Activity Heatmap */}
      <StreakHeatmap streak={stats?.streak} heatmap={stats?.heatmap} />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold uppercase text-slate-400">Tổng số thẻ</span>
          <p className="text-2xl font-black text-slate-900 mt-1">{stats?.totalCards || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold uppercase text-amber-600">Cần ôn hôm nay</span>
          <p className="text-2xl font-black text-amber-600 mt-1">{stats?.dueToday || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold uppercase text-sky-600">Đang học (Learning)</span>
          <p className="text-2xl font-black text-sky-600 mt-1">{stats?.learningCards || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold uppercase text-emerald-600">Thành thục (Review)</span>
          <p className="text-2xl font-black text-emerald-600 mt-1">{stats?.reviewCards || 0}</p>
        </div>
      </div>

      {/* Decks Grid */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
          <Layers className="w-5 h-5 text-slate-700" />
          <span>Danh sách Bộ Thẻ ({decks.length})</span>
        </h3>

        {decks.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-3">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
            <h4 className="text-base font-bold text-slate-800">Chưa có bộ thẻ flashcard nào</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Tạo bộ thẻ thủ công hoặc nhấn "Generate Flashcards" ở trang kết quả phỏng vấn để AI tự động trích xuất các điểm yếu cần ôn luyện.
            </p>
            <Button size="sm" onClick={() => setIsCreateDeckOpen(true)}>
              Tạo bộ thẻ đầu tiên
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {decks.map(deck => (
              <Card key={deck.id} className="flex flex-col justify-between hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-bold text-slate-900 line-clamp-1">
                      {deck.name}
                    </CardTitle>
                    {deck.dueCount > 0 ? (
                      <Badge variant="danger" className="shrink-0 text-[11px]">
                        {deck.dueCount} đến hạn
                      </Badge>
                    ) : (
                      <Badge variant="success" className="shrink-0 text-[11px]">
                        Đã xong
                      </Badge>
                    )}
                  </div>
                  {deck.description && (
                    <p className="text-xs text-slate-500 line-clamp-2 mt-1">{deck.description}</p>
                  )}
                </CardHeader>

                <CardContent className="pt-0 space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-3">
                    <span>{deck.cardCount} thẻ</span>
                    <div className="flex items-center space-x-1">
                      {deck.tags?.map((tag, idx) => (
                        <span key={idx} className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] text-slate-600 font-medium">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveDeckForNewCard(deck.id)}
                      className="text-xs"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      <span>Thêm thẻ</span>
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => navigate('/flashcards/review')}
                      disabled={deck.dueCount === 0}
                      className="text-xs"
                    >
                      <span>Học ngay</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Deck Modal */}
      {isCreateDeckOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Tạo Bộ Thẻ Flashcard Mới</h3>
            <form onSubmit={handleCreateDeckSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tên bộ thẻ</label>
                <input
                  type="text"
                  value={newDeckName}
                  onChange={e => setNewDeckName(e.target.value)}
                  placeholder="VD: System Design Core & Scalability"
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mô tả (Tùy chọn)</label>
                <textarea
                  value={newDeckDesc}
                  onChange={e => setNewDeckDesc(e.target.value)}
                  rows={3}
                  placeholder="VD: Tổng hợp các câu hỏi phân tán và cơ chế chịu lỗi..."
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateDeckOpen(false)}>
                  Hủy
                </Button>
                <Button type="submit" size="sm" isLoading={isCreatingDeck} disabled={!newDeckName.trim()}>
                  Tạo Bộ Thẻ
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Card Modal */}
      {activeDeckForNewCard && (
        <CreateCardModal
          isOpen={!!activeDeckForNewCard}
          onClose={() => setActiveDeckForNewCard(null)}
          deckId={activeDeckForNewCard}
          onCreateCard={createCard}
          isSubmitting={isCreatingCard}
        />
      )}
    </div>
  );
}
