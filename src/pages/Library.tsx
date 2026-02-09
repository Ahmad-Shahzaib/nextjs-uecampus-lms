import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Search, BookOpen } from "lucide-react";
import { useEditMode } from "@/contexts/EditModeContext";
import { apiFetch } from "@/lib/api";

interface BookResult {
  id: string;
  title: string;
  authors: string[];
  publisher?: string;
  publishedDate?: string;
  description?: string;
  thumbnail?: string;
  categories?: string[];
  pageCount?: number;
  language?: string;
  previewLink?: string;
  source: "google" | "openlibrary";
}

const EDUCATION_QUERY = "Education learning academic study skills teaching";

export default function Library() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useEditMode();
  const [bookSearchQuery, setBookSearchQuery] = useState("");
  const [books, setBooks] = useState<BookResult[]>([]);
  const [searchingBooks, setSearchingBooks] = useState(false);
  const [recommendedBooks, setRecommendedBooks] = useState<BookResult[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);

  useEffect(() => {
    if (user) {
      loadRecommendedBooks();
    }
  }, [user]);

  const loadRecommendedBooks = async () => {
    try {
      setLoadingRecommendations(true);
      const data = await apiFetch<{ books: BookResult[] }>("/library/search-books", {
        method: "POST",
        body: JSON.stringify({ query: EDUCATION_QUERY, maxResults: 12 }),
      });
      setRecommendedBooks(data.books || []);
    } catch (error) {
      console.error("Error loading educational books:", error);
      toast.error("Failed to load recommended books");
    } finally {
      setLoadingRecommendations(false);
    }
  };

  const handleBookClick = (book: BookResult) => {
    navigate(`/library/${book.id}`, { state: { book } });
  };

  const handleSearchBooks = async (query: string) => {
    if (!query.trim()) {
      setBooks([]);
      return;
    }

    try {
      setSearchingBooks(true);
      const data = await apiFetch<{ books: BookResult[] }>("/library/search-books", {
        method: "POST",
        body: JSON.stringify({ query, maxResults: 20 }),
      });

      setBooks(data.books || []);
      toast.success(`Found ${data.books?.length || 0} books`);
    } catch (error: any) {
      console.error("Error searching books:", error);
      toast.error("Failed to search books");
      setBooks([]);
    } finally {
      setSearchingBooks(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            eLibrary
          </h1>
          <p className="text-muted-foreground mt-1">
            Discover education-related books and resources
          </p>
        </div>
      </div>

      <Tabs defaultValue="recommended" className="w-full">
        <TabsList className="grid w-full max-w-3xl grid-cols-2">
          <TabsTrigger value="recommended">Educational Picks</TabsTrigger>
          <TabsTrigger value="search">Search Books</TabsTrigger>
        </TabsList>

        <TabsContent value="recommended" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">Education-focused books</h2>
              <p className="text-sm text-muted-foreground">
                Curated resources for learners and educators
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={loadRecommendedBooks} disabled={loadingRecommendations}>
              {loadingRecommendations ? "Refreshing..." : "Refresh"}
            </Button>
          </div>

          {loadingRecommendations ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : recommendedBooks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {recommendedBooks.map((book) => (
                <Card
                  key={book.id}
                  className="border-border/50 hover:shadow-lg transition-all hover:scale-105 duration-300 overflow-hidden cursor-pointer"
                  onClick={() => handleBookClick(book)}
                >
                  <CardContent className="p-0">
                    {book.thumbnail ? (
                      <div className="w-full h-48 bg-muted flex items-center justify-center overflow-hidden">
                        <img
                          src={book.thumbnail}
                          alt={book.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      </div>
                    ) : (
                      <div className="w-full h-48 bg-muted flex items-center justify-center">
                        <BookOpen className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                    <div className="p-4 space-y-2">
                      <div>
                        <h3 className="font-semibold text-sm line-clamp-2">{book.title}</h3>
                        {book.authors.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            by {book.authors[0]}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {book.categories?.slice(0, 2).map((cat, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {cat}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-primary pt-1">
                        <BookOpen className="h-3 w-3" />
                        <span>View Details</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No educational books available</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="search" className="space-y-4">
          <div className="flex gap-4">
            <div className="relative flex-1 max-w-2xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search for educational books (e.g., 'Teaching', 'Research', 'Academic success')..."
                value={bookSearchQuery}
                onChange={(e) => setBookSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearchBooks(bookSearchQuery)}
                className="pl-10"
              />
            </div>
            <Button
              onClick={() => handleSearchBooks(bookSearchQuery)}
              disabled={searchingBooks || !bookSearchQuery.trim()}
            >
              {searchingBooks ? "Searching..." : "Search"}
            </Button>
          </div>

          {searchingBooks && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          )}

          {!searchingBooks && books.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {books.map((book) => (
                <Card
                  key={book.id}
                  className="border-border/50 hover:shadow-lg transition-shadow overflow-hidden cursor-pointer"
                  onClick={() => handleBookClick(book)}
                >
                  <CardContent className="p-0">
                    {book.thumbnail ? (
                      <div className="w-full h-48 bg-muted flex items-center justify-center overflow-hidden">
                        <img
                          src={book.thumbnail}
                          alt={book.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      </div>
                    ) : (
                      <div className="w-full h-48 bg-muted flex items-center justify-center">
                        <BookOpen className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                    <div className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-sm line-clamp-2">{book.title}</h3>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {book.source === "google" ? "Google" : "OpenLib"}
                        </Badge>
                      </div>
                      {book.authors.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          by {book.authors.slice(0, 2).join(", ")}
                          {book.authors.length > 2 && " et al."}
                        </p>
                      )}
                      <div className="flex gap-2 flex-wrap">
                        {book.categories?.slice(0, 2).map((cat, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {cat}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-primary pt-2">
                        <BookOpen className="h-3 w-3" />
                        <span>View Details</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!searchingBooks && books.length === 0 && bookSearchQuery && (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No books found. Try a different search term.</p>
            </div>
          )}

          {!searchingBooks && books.length === 0 && !bookSearchQuery && (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Search for educational books using Google Books and Open Library.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Try topics such as "Teaching", "Research", or "Academic success".
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
