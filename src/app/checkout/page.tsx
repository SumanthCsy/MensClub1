
// @/app/checkout/page.tsx
"use client";

import { useState, useEffect, useCallback } from 'react';
import { ShippingForm, type ShippingFormValues } from '@/components/checkout/shipping-form';
import { PaymentMethodSelector } from '@/components/checkout/payment-method-selector';
import { CartSummary } from '@/components/cart/cart-summary';
import { Button } from '@/components/ui/button';
import { Lock, ArrowLeft, Loader2, Edit, Home, PlusCircle, AlertTriangle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/cart-context';
import { auth, db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, getDoc, query, where, getDocs, Timestamp } from 'firebase/firestore';
import type { Order, OrderItem, ShippingAddress as ShippingAddressType, UserData, Coupon } from '@/types';
import type { User as FirebaseUser } from 'firebase/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { AvailableCouponsModal } from '@/components/checkout/AvailableCouponsModal';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function CheckoutPage() {
  const { cartItems, cartTotal, clearCart } = useCart();
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('cod');
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isLoadingInitialAddress, setIsLoadingInitialAddress] = useState(true);
  
  const [currentConfirmedShippingAddress, setCurrentConfirmedShippingAddress] = useState<ShippingFormValues | null>(null);
  const [defaultShippingAddress, setDefaultShippingAddress] = useState<Partial<ShippingFormValues> | null>(null);
  
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addressFormMode, setAddressFormMode] = useState<'new' | 'edit'>('new');

  // Coupon State
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [isCouponsModalOpen, setIsCouponsModalOpen] = useState(false);


  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setIsLoadingInitialAddress(true);
      if (user) {
        setCurrentUser(user);
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data() as UserData;
            if (userData.defaultShippingAddress) {
              const fetchedDefaultAddress = userData.defaultShippingAddress as ShippingFormValues;
              setDefaultShippingAddress(fetchedDefaultAddress);
              setCurrentConfirmedShippingAddress(fetchedDefaultAddress); 
              setShowAddressForm(false);
            } else {
              setShowAddressForm(true); 
              setAddressFormMode('new');
              setCurrentConfirmedShippingAddress(null);
            }
          } else {
            setShowAddressForm(true); 
            setAddressFormMode('new');
            setCurrentConfirmedShippingAddress(null);
          }
        } catch (error) {
          console.error("Error fetching default shipping address:", error);
          toast({ title: "Error", description: "Could not load saved address.", variant: "destructive"});
          setShowAddressForm(true);
          setAddressFormMode('new');
          setCurrentConfirmedShippingAddress(null);
        }
      } else {
        setCurrentUser(null);
        setDefaultShippingAddress(null);
        setCurrentConfirmedShippingAddress(null);
        setShowAddressForm(true); 
        setAddressFormMode('new');
      }
      setIsLoadingInitialAddress(false);
    });
    return () => unsubscribe();
  }, [toast]);


  useEffect(() => {
    if (cartItems.length === 0 && !isPlacingOrder && router.asPath && !router.asPath.startsWith('/checkout/success')) {
        toast({
            title: "Your cart is empty",
            description: "Please add items to your cart before proceeding to checkout.",
            variant: "default",
        });
        router.push('/cart');
    }
  }, [cartItems, router, toast, isPlacingOrder]);

  const shippingCost = cartItems.length > 0 ? 50.00 : 0;
  const grandTotal = cartTotal + shippingCost - discountAmount;

  const handleShippingFormSubmit = (data: ShippingFormValues) => {
    setCurrentConfirmedShippingAddress(data);
    setShowAddressForm(false);
    toast({
      title: "Address Confirmed",
      description: "Your shipping address for this order has been confirmed.",
    });
  };

  const handleEditAddress = () => {
    setAddressFormMode('edit');
    setShowAddressForm(true);
  };

  const handleAddNewAddress = () => {
    setAddressFormMode('new');
    setCurrentConfirmedShippingAddress(null); 
    setShowAddressForm(true);
  };

  const handleApplyCoupon = useCallback(async (couponCode: string) => {
    if (!couponCode.trim()) {
      toast({ title: "Invalid Code", description: "Please enter a coupon code.", variant: "destructive" });
      return;
    }
    setIsApplyingCoupon(true);
    console.log(`[handleApplyCoupon] Attempting to apply coupon: ${couponCode.toUpperCase()}`);
    try {
      const couponsRef = collection(db, "coupons");
      const q = query(couponsRef, where("code", "==", couponCode.toUpperCase()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        console.log(`[handleApplyCoupon] Coupon ${couponCode.toUpperCase()} not found.`);
        toast({ title: "Invalid Coupon", description: "Coupon code not found.", variant: "destructive" });
        setAppliedCoupon(null);
        setDiscountAmount(0);
        setIsApplyingCoupon(false);
        return;
      }

      const couponDoc = querySnapshot.docs[0];
      const couponData = { id: couponDoc.id, ...couponDoc.data() } as Coupon;
      console.log("[handleApplyCoupon] Coupon data from Firestore:", couponData);

      if (!couponData.isActive) {
        console.log(`[handleApplyCoupon] Coupon ${couponData.code} is not active.`);
        toast({ title: "Coupon Inactive", description: "This coupon is no longer active.", variant: "destructive" });
        setIsApplyingCoupon(false); return;
      }

      const now = new Date();
      if (couponData.expiryDate) {
        const expiry = (couponData.expiryDate as Timestamp).toDate();
        console.log(`[handleApplyCoupon] Coupon ${couponData.code} expiry: ${expiry}, Current date: ${now}`);
        if (now > expiry) {
          console.log(`[handleApplyCoupon] Coupon ${couponData.code} has expired.`);
          toast({ title: "Coupon Expired", description: "This coupon has expired.", variant: "destructive" });
          setIsApplyingCoupon(false); return;
        }
      }

      if (couponData.minPurchaseAmount && cartTotal < couponData.minPurchaseAmount) {
        console.log(`[handleApplyCoupon] Coupon ${couponData.code} min purchase not met. Cart total: ${cartTotal}, Min purchase: ${couponData.minPurchaseAmount}`);
        toast({ title: "Minimum Spend Not Met", description: `This coupon requires a minimum purchase of ₹${couponData.minPurchaseAmount.toFixed(2)}.`, variant: "destructive" });
        setIsApplyingCoupon(false); return;
      }

      let calculatedDiscount = 0;
      if (couponData.discountType === 'percentage') {
        calculatedDiscount = (cartTotal * couponData.discountValue) / 100;
      } else { 
        calculatedDiscount = couponData.discountValue;
      }
      calculatedDiscount = Math.min(calculatedDiscount, cartTotal);
      console.log(`[handleApplyCoupon] Coupon ${couponData.code} applied. Discount calculated: ${calculatedDiscount}`);

      setAppliedCoupon(couponData);
      setDiscountAmount(calculatedDiscount);
      toast({ title: "Coupon Applied!", description: `${couponData.code} applied successfully.` });
      setIsCouponsModalOpen(false); // Close modal on successful apply

    } catch (error: any) {
      console.error("[handleApplyCoupon] Error applying coupon:", error);
      toast({ title: "Error Applying Coupon", description: error.message || "Could not apply coupon.", variant: "destructive" });
      setAppliedCoupon(null);
      setDiscountAmount(0);
    } finally {
      setIsApplyingCoupon(false);
    }
  }, [cartTotal, toast]);

  const handleRemoveCoupon = useCallback(() => {
    setAppliedCoupon(null);
    setDiscountAmount(0);
    toast({ title: "Coupon Removed" });
  }, [toast]);


  const handlePlaceOrder = () => {
    if (!currentUser) {
      toast({ title: "Login Required", description: "Please login to place an order.", variant: "destructive" });
      router.push('/login?redirect=/checkout');
      return;
    }
    if (cartItems.length === 0) {
      toast({ title: "Cannot Place Order", description: "Your cart is empty.", variant: "destructive" });
      return;
    }
    if (!currentConfirmedShippingAddress) {
      toast({ title: "Shipping Address Required", description: "Please confirm your shipping address first.", variant: "destructive" });
      return;
    }
    if (!selectedPaymentMethod) {
      toast({ title: "Payment Method Required", description: "Please select a payment method.", variant: "destructive" });
      return;
    }

    setIsPlacingOrder(true);

    const orderItemsForDb: OrderItem[] = cartItems.map(item => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      selectedSize: item.selectedSize,
      selectedColor: item.selectedColor || null,
      imageUrl: item.imageUrl || 'https://placehold.co/100x133.png',
      sku: item.sku || null,
    }));

    const shippingAddressForDb: ShippingAddressType = {
      fullName: currentConfirmedShippingAddress.fullName,
      addressLine1: currentConfirmedShippingAddress.addressLine1,
      addressLine2: currentConfirmedShippingAddress.addressLine2 || null,
      city: currentConfirmedShippingAddress.city,
      stateProvince: currentConfirmedShippingAddress.stateProvince,
      postalCode: currentConfirmedShippingAddress.postalCode,
      country: currentConfirmedShippingAddress.country,
      phoneNumber: currentConfirmedShippingAddress.phoneNumber || null,
      email: currentConfirmedShippingAddress.email,
    };
    
    const newOrderPayload: Omit<Order, 'id' | 'cancellationReason' | 'cancelledBy'> = {
      userId: currentUser.uid,
      customerEmail: currentConfirmedShippingAddress.email, 
      items: orderItemsForDb,
      subtotal: cartTotal,
      shippingCost: shippingCost,
      discount: discountAmount > 0 ? discountAmount : null,
      appliedCouponCode: appliedCoupon ? appliedCoupon.code : null,
      grandTotal: grandTotal,
      shippingAddress: shippingAddressForDb,
      paymentMethod: selectedPaymentMethod,
      status: 'Pending' as Order['status'],
      createdAt: serverTimestamp(),
    };

    addDoc(collection(db, "orders"), newOrderPayload)
    .then(async (docRef) => {
        if (currentUser && currentConfirmedShippingAddress) {
            try {
              const userDocRef = doc(db, "users", currentUser.uid);
              await updateDoc(userDocRef, { defaultShippingAddress: currentConfirmedShippingAddress }, { merge: true });
            } catch (userUpdateError) {
              console.warn("Error updating user's default shipping address:", userUpdateError);
            }
        }
        
        clearCart();
        setAppliedCoupon(null);
        setDiscountAmount(0);
        router.push(`/checkout/success/${docRef.id}`);
    })
    .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: `orders/new-id`,
            operation: 'create',
            requestResourceData: newOrderPayload,
        });
        errorEmitter.emit('permission-error', permissionError);
    })
    .finally(() => {
        setIsPlacingOrder(false);
    });
  };
  
  let formInitialData: Partial<ShippingFormValues> = { country: "India", email: currentUser?.email || "" };
  if (addressFormMode === 'edit' && currentConfirmedShippingAddress) {
    formInitialData = { ...currentConfirmedShippingAddress, email: currentConfirmedShippingAddress.email || currentUser?.email || "" };
  } else if (addressFormMode === 'new') {
    formInitialData = { country: "India", email: currentUser?.email || "" };
  } else if (defaultShippingAddress) { 
    formInitialData = { ...defaultShippingAddress, email: defaultShippingAddress.email || currentUser?.email || ""};
  }


  if (isLoadingInitialAddress) {
    return (
      <div className="container mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8 py-12 md:py-16 text-center">
        <Loader2 className="mx-auto h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-lg text-muted-foreground">Loading checkout details...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8 py-12 md:py-16">
      <div className="mb-10 text-center">
         <Button variant="outline" size="sm" asChild className="mb-4 float-left">
          <Link href="/cart">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Cart
          </Link>
        </Button>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground pt-2">Checkout</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Almost there! Please complete your order details.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8 md:gap-12 items-start">
        <div className="lg:col-span-2 space-y-8">
          {!showAddressForm && currentConfirmedShippingAddress ? (
            <Card className="shadow-lg border border-border/60">
              <CardHeader>
                <CardTitle className="text-2xl font-semibold flex items-center justify-between">
                  Shipping To
                  <Button variant="outline" size="sm" onClick={handleEditAddress}>
                    <Edit className="mr-2 h-4 w-4" /> Edit Address
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-base">
                <p><strong>{currentConfirmedShippingAddress.fullName}</strong></p>
                <p>{currentConfirmedShippingAddress.addressLine1}</p>
                {currentConfirmedShippingAddress.addressLine2 && <p>{currentConfirmedShippingAddress.addressLine2}</p>}
                <p>{currentConfirmedShippingAddress.city}, {currentConfirmedShippingAddress.stateProvince} {currentConfirmedShippingAddress.postalCode}</p>
                <p>{currentConfirmedShippingAddress.country}</p>
                {currentConfirmedShippingAddress.phoneNumber && <p>Phone: {currentConfirmedShippingAddress.phoneNumber}</p>}
                <p>Email: {currentConfirmedShippingAddress.email}</p>
              </CardContent>
              <CardFooter>
                <Button variant="link" onClick={handleAddNewAddress} className="text-primary pl-0">
                  <PlusCircle className="mr-2 h-4 w-4" /> Use a Different Address
                </Button>
              </CardFooter>
            </Card>
          ) : (
            <ShippingForm
              onSubmit={handleShippingFormSubmit}
              initialData={formInitialData}
            />
          )}

          <PaymentMethodSelector
            selectedMethod={selectedPaymentMethod}
            onMethodChange={setSelectedPaymentMethod}
          />
        </div>

        <div className="lg:col-span-1 lg:sticky lg:top-24">
          <CartSummary
            subtotal={cartTotal}
            shippingCost={shippingCost}
            discountAmount={discountAmount}
            total={grandTotal}
            showCheckoutButton={false}
            appliedCouponCode={appliedCoupon?.code}
            onApplyPromoCode={handleApplyCoupon}
            onRemoveCoupon={handleRemoveCoupon}
            onViewCouponsClick={() => setIsCouponsModalOpen(true)}
            isApplyingCoupon={isApplyingCoupon}
          />
          <Button
            size="lg"
            className="w-full text-base group mt-6"
            onClick={handlePlaceOrder}
            disabled={cartItems.length === 0 || isPlacingOrder || !currentConfirmedShippingAddress}
          >
            {isPlacingOrder ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Lock className="mr-2 h-5 w-5" />
            )}
            Place Order Securely
          </Button>
          {!currentConfirmedShippingAddress && cartItems.length > 0 && (
             <div className="mt-2 p-3 bg-yellow-50 border border-yellow-300 rounded-md text-yellow-700 flex items-start text-xs">
                <AlertTriangle className="h-4 w-4 mr-2 shrink-0 mt-0.5" />
                <p>Please confirm your shipping details to enable order placement.</p>
            </div>
          )}
        </div>
      </div>
      <AvailableCouponsModal
        isOpen={isCouponsModalOpen}
        onClose={() => setIsCouponsModalOpen(false)}
        onApplyCoupon={async (code) => {
          await handleApplyCoupon(code);
        }}
        currentSubtotal={cartTotal}
      />
    </div>
  );
}
