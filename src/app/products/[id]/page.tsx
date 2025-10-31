
// src/app/products/[id]/page.tsx
"use client"; // This page is a client component

// All client-specific imports for ProductDetailsClientContent
import { useState, useEffect, useMemo, useCallback, use } from 'react'; // 'use' is imported
// useParams is not needed if params are passed down directly
import { useRouter } from 'next/navigation';
import type { Product, Review, UserData, ProductVariant } from '@/types';
import { Button } from '@/components/ui/button';
import { ProductImageGallery } from '@/components/products/product-image-gallery';
import { SizeSelector } from '@/components/products/size-selector';
import { UserReviews } from '@/components/products/user-reviews';
import { RatingStars } from '@/components/shared/rating-stars';
import { Heart, Share2, ShoppingCart, CheckCircle, AlertTriangle, Loader2, Percent, LogIn, Copy, MessageSquare } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { doc, onSnapshot, Unsubscribe, Timestamp, updateDoc, arrayUnion, getDoc, arrayRemove } from "firebase/firestore";
import { auth, db } from '@/lib/firebase';
import { useCart } from '@/context/cart-context';
import { useWishlist } from '@/context/wishlist-context';
import { OfferCountdownTimer } from '@/components/products/OfferCountdownTimer';
import type { User as FirebaseUser } from 'firebase/auth';
import { v4 as uuidv4 } from 'uuid';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import Link from 'next/link';
import { CustomLoader } from '@/components/layout/CustomLoader';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

// Client Component that handles all the logic and state
function ProductDetailsClientContent({ productId }: { productId: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const { toast } = useToast();
  const { addToCart: addToCartContext, isLoadingCart } = useCart();
  const { addToWishlist, removeFromWishlist, isProductInWishlist, isLoadingWishlist } = useWishlist();
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const router = useRouter();

  const [showLoginRequiredModal, setShowLoginRequiredModal] = useState(false);
  const [loginRedirectAction, setLoginRedirectAction] = useState<'cart' | 'wishlist' | null>(null);

  const isWishlisted = product ? isProductInWishlist(product.id) : false;

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(user => {
      setCurrentUser(user);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (product && product.variants && product.variants.length > 0 && !selectedVariant) {
      const firstAvailableVariant = product.variants.find(v => v.stock > 0) || product.variants[0];
      setSelectedVariant(firstAvailableVariant);
    }
  }, [product, selectedVariant]);

  useEffect(() => {
    if (!productId) {
      setError("Product ID is missing."); setIsLoading(false); return;
    }
    setIsLoading(true); setError(null);
    const productRef = doc(db, "products", productId);
    const unsubscribe: Unsubscribe = onSnapshot(productRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProduct({
            id: docSnap.id,
            ...data,
            // Ensure reviews and variants are always arrays, even if undefined in Firestore
            reviews: Array.isArray(data.reviews) ? data.reviews : [],
            variants: Array.isArray(data.variants) ? data.variants : [],
            offerStartDate: data.offerStartDate, // Keep as Timestamp or convert if needed
            offerEndDate: data.offerEndDate,   // Keep as Timestamp or convert if needed
        } as Product);
      } else {
        setError("Product not found."); setProduct(null);
      }
      setIsLoading(false);
    }, (err) => {
      console.error("Error fetching product details with onSnapshot:", err);
      setError("Failed to load product details."); setIsLoading(false);
    });
    return () => unsubscribe();
  }, [productId]);

  const discountPercentage = useMemo(() => {
    if (product && product.originalPrice && product.price && product.originalPrice > product.price) {
      return Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
    }
    return 0;
  }, [product]);

  const handleSizeChange = (size: string) => {
    const variant = product?.variants.find(v => v.size === size);
    setSelectedVariant(variant || null);
  };

  const handleAddToCart = async () => {
    if (!product || !selectedVariant || !selectedVariant.size) {
        toast({ title: "Selection Required", description: "Please select a size.", variant: "destructive" }); return;
    }
    if (!currentUser) {
      setLoginRedirectAction('cart'); setShowLoginRequiredModal(true); return;
    }
     // Find the product variant again to ensure we have the latest stock info
    const currentProductVariant = product.variants.find(v => v.size === selectedVariant.size);
    if (!currentProductVariant || currentProductVariant.stock < 1) {
      toast({ title: "Out of Stock", description: "This size is currently out of stock.", variant: "destructive" }); return;
    }
    await addToCartContext(product, selectedVariant.size, product.colors?.[0]);
  };

  const handleToggleWishlist = async () => {
    if (!currentUser) {
      setLoginRedirectAction('wishlist'); setShowLoginRequiredModal(true); return;
    }
    if (!product || !product.id) return;
    if (isWishlisted) await removeFromWishlist(product.id);
    else await addToWishlist(product.id);
  };

  const handleReviewSubmit = useCallback(async (prodId: string, rating: number, comment: string) => {
    if (!currentUser) {
      setShowLoginRequiredModal(true); // Show login modal instead of toast
      return;
    }
    if (!product) {
      toast({ title: "Error", description: "Product not found.", variant: "destructive" }); return;
    }
    let authorName = "Anonymous";
    try {
      if (currentUser.displayName) {
        authorName = currentUser.displayName;
      } else {
        const userDocRef = doc(db, "users", currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data() as UserData;
          if (userData.fullName) authorName = userData.fullName;
        }
      }
    } catch (fetchError) { console.error("Error fetching user data for review author name:", fetchError); }
    
    if (!authorName || authorName === currentUser.email) { // Avoid using email as author name
        authorName = "Anonymous";
    }


    const newReview: Review = {
      id: uuidv4(), userId: currentUser.uid, author: authorName,
      avatarUrl: currentUser.photoURL || null, // Ensure null instead of undefined
      rating, comment, date: new Date().toISOString(),
    };
    
    const productRef = doc(db, "products", prodId);
    updateDoc(productRef, { reviews: arrayUnion(newReview) })
    .then(() => {
        toast({ title: "Review Submitted!", description: "Thank you for your feedback." });
    })
    .catch(async (serverError) => {
        const currentProductSnap = await getDoc(productRef);
        if (!currentProductSnap.exists()) {
            toast({ title: "Error", description: "Product not found for review submission.", variant: "destructive" });
            return;
        }
        const currentProductData = currentProductSnap.data() as Product;
        const existingReviews = currentProductData.reviews || [];
        if (existingReviews.some(review => review.userId === currentUser.uid)) {
            toast({ title: "Already Reviewed", description: "You have already submitted a review for this product.", variant: "default" });
            return;
        }

        const permissionError = new FirestorePermissionError({
            path: productRef.path,
            operation: 'update',
            requestResourceData: { reviews: arrayUnion(newReview) },
        });
        errorEmitter.emit('permission-error', permissionError);
    });
  }, [currentUser, product, toast]);

  const handleDeleteReview = useCallback(async (prodId: string, reviewId: string, reviewObject: Review) => {
    if (!currentUser || !product) { toast({ title: "Error", description: "Action not allowed or product not found.", variant: "destructive" }); return; }
    if (reviewObject.userId !== currentUser.uid) { toast({ title: "Unauthorized", description: "You can only delete your own reviews.", variant: "destructive" }); return; }
    
    const productRef = doc(db, "products", prodId);
    updateDoc(productRef, { reviews: arrayRemove(reviewObject) })
    .then(() => {
        toast({ title: "Review Deleted", description: "Your review has been successfully deleted." });
    })
    .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: productRef.path,
            operation: 'update',
            requestResourceData: { reviews: arrayRemove(reviewObject) },
        });
        errorEmitter.emit('permission-error', permissionError);
    });
  }, [currentUser, product, toast]);

  const handleUpdateReview = useCallback(async (prodId: string, reviewId: string, newRating: number, newComment: string) => {
    if (!currentUser || !product) { toast({ title: "Error", description: "Action not allowed or product not found.", variant: "destructive" }); return; }
    
    const productRef = doc(db, "products", prodId);
    const productSnap = await getDoc(productRef);
    if (!productSnap.exists()) {
        toast({ title: "Error", description: "Product not found for review update.", variant: "destructive" });
        return;
    }
    const productData = productSnap.data() as Product;
    const reviews = productData.reviews || [];
    const updatedReviews = reviews.map(review => review.id === reviewId && review.userId === currentUser.uid ? { ...review, rating: newRating, comment: newComment, date: new Date().toISOString() } : review);
    
    updateDoc(productRef, { reviews: updatedReviews })
    .then(() => {
        toast({ title: "Review Updated", description: "Your review has been updated." });
    })
    .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: productRef.path,
            operation: 'update',
            requestResourceData: { reviews: updatedReviews },
        });
        errorEmitter.emit('permission-error', permissionError);
    });
  }, [currentUser, product, toast]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
      .then(() => toast({ title: "Link Copied!", description: "Product link copied to clipboard." }))
      .catch(err => {
        console.error("Failed to copy link: ", err);
        toast({ title: "Copy Failed", description: "Could not copy link.", variant: "destructive" });
      });
  };

  const handleShareOnWhatsApp = () => {
    if (!product) return;
    const message = `Check out this product: ${product.name} - ${window.location.href}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  if (isLoading || isLoadingWishlist || isLoadingCart) return <div className="flex justify-center items-center min-h-[calc(100vh-200px)]"><CustomLoader /></div>;
  if (error) return <div className="text-center py-20"><AlertTriangle className="mx-auto h-16 w-16 text-destructive mb-4" /><h1 className="text-3xl font-bold text-destructive mb-2">{error}</h1><p className="text-lg text-muted-foreground">Sorry, we couldn't load the product.</p><Button asChild className="mt-6"><Link href="/products">Back to Products</Link></Button></div>;
  if (!product) return <div className="text-center py-20"><AlertTriangle className="mx-auto h-16 w-16 text-muted-foreground mb-4" /><h1 className="text-3xl font-bold text-muted-foreground mb-2">Product Unavailable</h1><Button asChild className="mt-6"><Link href="/products">Back to Products</Link></Button></div>;

  const effectiveReviewCount = product.reviews?.length || 0;
  const effectiveAverageRating = product.reviews && effectiveReviewCount > 0 ? product.reviews.reduce((acc, review) => acc + review.rating, 0) / effectiveReviewCount : 0;

  const displayModeForSizeSelector =
    (product.category?.toLowerCase() === 'jeans' || product.category?.toLowerCase() === 'trousers' || (product.variants && product.variants.length > 4))
      ? 'dropdown'
      : (product.variants && product.variants.length > 6)
      ? 'dropdown'
      : 'radio';

  return (
    <>
    <div className="container mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8 py-12 md:py-16">
      <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-start">
        <ProductImageGallery images={product.images || (product.imageUrl ? [product.imageUrl] : [])} altText={product.name} mainImageHint={product.dataAiHint} />
        <div className="space-y-6">
          <div className="space-y-2">
            {product.brand && <p className="text-sm font-medium text-primary tracking-wide uppercase">{product.brand}</p>}
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">{product.name}</h1>
            <div className="flex items-center gap-3 pt-1">
              {effectiveReviewCount > 0 ? (
                <><RatingStars rating={effectiveAverageRating} size={20} /><span className="text-sm text-muted-foreground">({effectiveReviewCount} reviews)</span></>
              ) : <span className="text-sm text-muted-foreground">No reviews yet</span>}
            </div>
          </div>
          <div className="flex items-baseline gap-3">
            <p className="text-3xl font-bold text-primary">₹{product.price.toFixed(2)}</p>
            {product.originalPrice && product.originalPrice > product.price && (
              <><p className="text-xl text-muted-foreground line-through">₹{product.originalPrice.toFixed(2)}</p>
              {discountPercentage > 0 && <Badge variant="destructive" className="text-sm"><Percent className="mr-1 h-3.5 w-3.5" /> {discountPercentage}% OFF</Badge>}</>
            )}
          </div>
          {(product.offerStartDate || product.offerEndDate) && <OfferCountdownTimer offerStartDate={product.offerStartDate} offerEndDate={product.offerEndDate} className="my-3" />}
          {selectedVariant ? (
            selectedVariant.stock > 0 ? (
              <div className="flex items-center gap-2 text-green-600"><CheckCircle className="h-5 w-5" /><p className="text-sm font-medium">In Stock ({selectedVariant.stock} available for size {selectedVariant.size})</p></div>
            ) : (
              <div className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" /><p className="text-sm font-medium">Out of Stock (for size {selectedVariant.size})</p></div>
            )
          ) : product.variants && product.variants.length > 0 ? (
             <p className="text-sm text-muted-foreground">Select a size to check availability.</p>
          ) : (
             <div className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" /><p className="text-sm font-medium">Currently Unavailable</p></div>
          )}
          <Separator />
          <p className="text-foreground/80 leading-relaxed text-base whitespace-pre-line">{product.description}</p>
          {product.variants && product.variants.length > 0 && (
            <SizeSelector
              variants={product.variants}
              selectedSize={selectedVariant?.size || ''}
              onSizeChange={handleSizeChange}
              className="my-6"
              displayMode={displayModeForSizeSelector}
              category={product.category}
            />
          )}
          <div className="flex flex-col sm:flex-row gap-3 mt-8">
            <Button size="lg" className="flex-1 text-base" onClick={handleAddToCart} disabled={isLoadingCart || !product || !selectedVariant || selectedVariant.stock <= 0}>
              <ShoppingCart className="mr-2 h-5 w-5" /> {isLoadingCart ? 'Adding...' : 'Add to Cart'}
            </Button>
            <Button variant="outline" size="lg" className="flex-1 text-base" onClick={handleToggleWishlist} disabled={isLoadingWishlist}>
              <Heart className={`mr-2 h-5 w-5 ${isWishlisted ? 'fill-red-500 text-red-500' : ''}`} />
              {isLoadingWishlist ? 'Updating...' : (isWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist')}
            </Button>
          </div>
          <div className="flex items-center justify-start gap-3 pt-4">
            <Popover>
              <PopoverTrigger asChild><Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary"><Share2 className="mr-2 h-4 w-4" /> Share</Button></PopoverTrigger>
              <PopoverContent className="w-auto p-2 space-y-1">
                <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleCopyLink}><Copy className="mr-2 h-4 w-4" /> Copy Link</Button>
                <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleShareOnWhatsApp}><MessageSquare className="mr-2 h-4 w-4" /> WhatsApp</Button>
              </PopoverContent>
            </Popover>
            {product.sku && <Badge variant="secondary">SKU: {product.sku}</Badge>}
            {selectedVariant?.sku && <Badge variant="outline">Size SKU: {selectedVariant.sku}</Badge>}
          </div>
        </div>
      </div>
      <div className="mt-16 md:mt-24">
        <UserReviews
          productId={product.id} reviews={product.reviews || []}
          isAuthenticated={!!currentUser} currentUser={currentUser}
          onReviewSubmit={handleReviewSubmit} onDeleteReview={handleDeleteReview} onUpdateReview={handleUpdateReview}
        />
      </div>
    </div>
    {showLoginRequiredModal && (
        <AlertDialog open={showLoginRequiredModal} onOpenChange={setShowLoginRequiredModal}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2"><LogIn className="h-6 w-6 text-primary" />Login Required</AlertDialogTitle>
              <AlertDialogDescription>You need to be logged in to {loginRedirectAction === 'cart' ? 'add items to your cart' : (loginRedirectAction === 'wishlist' ? 'manage your wishlist' : 'perform this action')}. Would you like to log in now?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowLoginRequiredModal(false)}>Cancel</AlertDialogCancel>
              <AlertDialogAction asChild><Link href={`/login?redirect=${encodeURIComponent(router.asPath)}`}>Login</Link></AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}

// Main page component
export default function ProductDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params); // Use React.use to resolve the params promise
  const productId = resolvedParams.id;

  if (typeof productId !== 'string') {
    return <div className="text-center py-20">Invalid product ID.</div>;
  }
  return <ProductDetailsClientContent productId={productId} />;
}
