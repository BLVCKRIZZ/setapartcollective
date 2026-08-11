/* ===========================
   SET APART COLLECTIVE
=========================== */

const menuBtn = document.querySelector(".menu-btn");
const overlay = document.querySelector(".overlay-menu");
const menuLinks = document.querySelectorAll(".overlay-menu a");
const loader = document.getElementById("loader");
const bag = document.querySelector(".bag-icon");
const cart = document.querySelector(".cart");
const close = document.querySelector(".close-cart");
const paystackPublicKey = "pk_test_7f24826e27595b3144c0929b62dc7d749677a70f"; // Update this with your Paystack public key

let toastTimeout = null;
let emailModal = null;
let emailInput = null;

function getToast() {
  let toast = document.querySelector(".toast-container");
  if(!toast){
    toast = document.createElement("div");
    toast.className = "toast-container";
    toast.innerHTML = "<div class='toast-message'></div>";
    document.body.appendChild(toast);
  }
  return toast;
}

function showToast(message, type = "info") {
  const toast = getToast();
  const messageEl = toast.querySelector(".toast-message");
  toast.className = `toast-container toast-${type}`;
  messageEl.textContent = message;
  toast.classList.add("visible");

  clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => {
    toast.classList.remove("visible");
  }, 3800);
}

function createEmailModal() {
  const modal = document.createElement("div");
  modal.className = "email-modal-overlay";
  modal.innerHTML = `
    <div class="email-modal">
      <button type="button" class="email-modal-close" aria-label="Close email form">×</button>
      <h2>Enter your email</h2>
      <p>Please provide an email address for your payment receipt.</p>
      <input type="email" class="email-modal-input" placeholder="you@example.com" />
      <div class="email-modal-actions">
        <button type="button" class="email-modal-submit">Continue to Pay</button>
        <button type="button" class="email-modal-cancel">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  return modal;
}

function setupEmailModalEvents(modal) {
  const closeBtn = modal.querySelector(".email-modal-close");
  const cancelBtn = modal.querySelector(".email-modal-cancel");
  const submitBtn = modal.querySelector(".email-modal-submit");

  modal.addEventListener("click", (event) => {
    if(event.target === modal) closeEmailModal();
  });

  closeBtn.onclick = closeEmailModal;
  cancelBtn.onclick = closeEmailModal;
  submitBtn.onclick = () => {
    const email = emailInput.value.trim();
    if(!email || !email.includes("@")){
      showToast("Please enter a valid email address.", "error");
      emailInput.focus();
      return;
    }
    closeEmailModal();
    payWithPaystack(email);
  };
}

function getEmailModal() {
  if(!emailModal){
    emailModal = createEmailModal();
    emailInput = emailModal.querySelector(".email-modal-input");
    setupEmailModalEvents(emailModal);
  }
  return emailModal;
}

function openEmailModal() {
  const modal = getEmailModal();
  modal.classList.add("visible");
  emailInput.value = "";
  emailInput.focus();
}

function closeEmailModal() {
  const modal = getEmailModal();
  modal.classList.remove("visible");
}

function loadPaystackScript() {
  return new Promise((resolve, reject) => {
    if(window.PaystackPop) {
      return resolve(window.PaystackPop);
    }

    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.onload = () => {
      if(window.PaystackPop) {
        resolve(window.PaystackPop);
      } else {
        reject(new Error("Paystack did not initialize properly."));
      }
    };
    script.onerror = () => reject(new Error("Failed to load Paystack script."));
    document.head.appendChild(script);
  });
}

function getCartTotalAmountKobo() {
  return Math.round(cartItems.reduce((sum, item) => {
    const price = parseFloat(String(item.price).replace(/[^0-9.]/g, "")) || 0;
    return sum + price * (item.qty || 1);
  }, 0) * 100);
}

async function payWithPaystack(email) {
  if(!paystackPublicKey || paystackPublicKey.includes("REPLACE_WITH_YOUR_PUBLIC_KEY")){
    showToast("Please set your Paystack public key in jsscript.js.", "error");
    return;
  }

  if(cartItems.length === 0){
    showToast("Your bag is empty.", "warning");
    return;
  }

  if(!email){
    openEmailModal();
    return;
  }

  const amount = getCartTotalAmountKobo();
  if(amount <= 0){
    showToast("Unable to process payment for an empty order.", "error");
    return;
  }

  try {
    const Paystack = await loadPaystackScript();
    const handler = Paystack.setup({
      key: paystackPublicKey,
      email,
      amount,
      currency: "ZAR",
      ref: `SETAPART_${Date.now()}`,
      metadata: {
        custom_fields: [
          { display_name: "Customer Email", variable_name: "customer_email", value: email },
          { display_name: "Order Total", variable_name: "order_total", value: (amount / 100).toFixed(2) },
          { display_name: "Order Items", variable_name: "order_items", value: JSON.stringify(cartItems) }
        ]
      },
      callback: (response) => {
        showToast(`Payment successful! Reference: ${response.reference}`, "success");
        cartItems = [];
        saveCart();
        updateCartDisplay();
        setCartOpen(false);
      },
      onClose: () => {
        showToast("Payment window closed. Your order was not completed.", "warning");
      }
    });
    handler.openIframe();
  } catch (error) {
    console.error("Paystack checkout failed:", error);
    showToast("Unable to start payment at this time. Please try again later.", "error");
  }
}

function hideCurrentPageLink() {
  const currentPath = location.pathname.replace(/^.*[\\/]/, "").toLowerCase() || "index.html";
  const normalizedCurrent = currentPath === "" ? "index.html" : currentPath;

  menuLinks.forEach(link => {
    try {
      const linkUrl = new URL(link.href, location.href);
      const linkPath = linkUrl.pathname.replace(/^.*[\\/]/, "").toLowerCase();
      const normalizedLink = linkPath === "" ? "index.html" : linkPath;

      if (normalizedLink === normalizedCurrent) {
        link.style.display = "none";
      }
    } catch (error) {
      // ignore invalid URLs or same-page anchors
    }
  });
}

function updateBodyLock() {
  const shouldLock = !!document.querySelector(".overlay-menu.active, .cart.active");
  document.body.style.overflow = shouldLock ? "hidden" : "";
}

function setMenuOpen(isOpen) {
  if(!menuBtn || !overlay) return;

  overlay.classList.toggle("active", isOpen);
  menuBtn.classList.toggle("open", isOpen);
  document.body.classList.toggle("menu-open", isOpen);
  updateBodyLock();

  const lines = menuBtn.querySelectorAll("span");
  if(lines.length){
    lines[0].style.transform = isOpen ? "rotate(45deg) translateY(6px)" : "rotate(0)";
    lines[1].style.transform = isOpen ? "rotate(-45deg) translateY(-6px)" : "rotate(0)";
  }
}

function setCartOpen(isOpen) {
  if(!cart) return;

  cart.classList.toggle("active", isOpen);
  document.body.classList.toggle("cart-open", isOpen);
  updateBodyLock();
}

if(menuBtn){
  menuBtn.addEventListener("click", (event) => {
    // ensure the click always toggles the overlay even if other handlers exist
    event.preventDefault();
    event.stopPropagation();
    // Small timeout to allow any in-flight pointer events to settle before toggling
    setTimeout(() => {
      setMenuOpen(!overlay?.classList.contains("active"));
    }, 10);
  });
}

if(overlay){
  overlay.addEventListener("click", (event) => {
    if(event.target === overlay){
      setMenuOpen(false);
    }
  });
}

menuLinks.forEach(link => {
  link.addEventListener("click", () => setMenuOpen(false));
});

const closeMenu = document.querySelector(".close-menu");
if(closeMenu){
  closeMenu.addEventListener("click", () => setMenuOpen(false));
}

document.addEventListener("keydown", (event) => {
  if(event.key === "Escape"){
    if(cart?.classList.contains("active")){
      setCartOpen(false);
    } else {
      setMenuOpen(false);
    }
  }
});

document.addEventListener("click", (event) => {
  if(!cart || cart.classList.contains("active") === false) return;
  if(cart.contains(event.target) || bag?.contains(event.target)) return;
  setCartOpen(false);
});

window.addEventListener("pageshow", () => {
  hideCurrentPageLink();
  setMenuOpen(false);
  setCartOpen(false);
  updateBodyLock();
});


/* ===========================
NAVBAR SCROLL
=========================== */

const header = document.querySelector("header");

window.addEventListener("scroll",()=>{

if(window.scrollY>50){

header.style.background="rgba(255,255,255,.96)";
header.style.padding="16px 48px";
header.style.boxShadow="0 8px 28px rgba(0,0,0,.06)";

}else{

header.style.background="transparent";
header.style.padding="22px 48px";
header.style.boxShadow="none";

}

});


/* ===========================
PRODUCT IMAGE HOVER
=========================== */

function getBackImage(src) {
  if(!src) return src;

  const lower = src.toLowerCase();

  if(lower.includes("front")){
    return src.replace(/front/i, "back");
  }

  if(lower.includes("f.")){
    return src.replace(/f\.(jpg|jpeg|png|gif|webp)$/i, "b.png");
  }

  return src;
}

const products = document.querySelectorAll(".product");

products.forEach(product=>{

    const img = product.querySelector("img");

    if(!img) return;

    const front = img.getAttribute("src");
    const back = img.getAttribute("data-back") || getBackImage(front);

    if(!back || back === front) return;

    product.addEventListener("mouseenter",()=>{

        img.src = back;

    });

    product.addEventListener("mouseleave",()=>{

        img.src = front;

    });

});


/* ===========================
FADE ON SCROLL
=========================== */

const observer = new IntersectionObserver((entries)=>{

entries.forEach(entry=>{

if(entry.isIntersecting){

entry.target.classList.add("show");

}

});

},{
threshold:.2
});

document.querySelectorAll(".collection,.featured,.product,.lookbook-grid img").forEach(el=>{

observer.observe(el);

});


/* ===========================
SMOOTH BUTTON EFFECT
=========================== */

document.querySelectorAll(".shop-btn").forEach(button=>{

button.addEventListener("mouseenter",()=>{

button.style.transform="translateY(-3px)";

});

button.addEventListener("mouseleave",()=>{

button.style.transform="translateY(0px)";

});

});

window.addEventListener("load",()=>{

if(loader){

setTimeout(()=>{

loader.style.opacity="0";

loader.style.pointerEvents="none";

document.body.classList.add("page-ready");

},1200);

}else{

document.body.classList.add("page-ready");

}

});

/* ===========================
CART FUNCTIONALITY
=========================== */

let cartItems = [];

// Load cart from localStorage
function loadCart(){
  try{
    const saved = localStorage.getItem("setApartCart");
    cartItems = saved ? JSON.parse(saved) : [];
    updateCartDisplay();
  }catch(e){
    console.log("Cart load error:", e);
  }
}

// Save cart to localStorage
function saveCart(){
  try{
    localStorage.setItem("setApartCart", JSON.stringify(cartItems));
  }catch(e){
    console.log("Cart save error:", e);
  }
}

// Update cart display
function updateCartDisplay(){
  try{
    const cartBody = document.querySelector(".cart-empty");
    if(!cartBody) return;
    
    if(cartItems.length === 0){
      cartBody.innerHTML = "Your bag is empty.";
      cartBody.style.textAlign = "center";
      cartBody.style.padding = "40px 20px";
      const footer = document.querySelector(".cart-footer");
      if(footer) footer.style.display = "none";
    }else{
      let html = "";
      let total = 0;
      cartItems.forEach((item, idx) => {
        const itemPrice = parseFloat(String(item.price).replace(/[^0-9.]/g, "")) * (item.qty || 1);
        total += itemPrice;
        html += `<div style="display:flex; gap:12px; border-bottom:1px solid #e8e8e8; padding:16px 0; align-items:flex-start;">
          <img src="${item.image}" style="width:60px; height:60px; object-fit:cover; aspect-ratio:1;">
          <div style="flex:1;">
            <p style="margin:0 0 4px 0; font-weight:500; font-size:13px;">${item.name}</p>
            <p style="margin:0 0 4px 0; font-size:12px; color:#6c6c6c;">Size: ${item.size}</p>
            <p style="margin:0 0 8px 0; font-weight:600; font-size:13px;">${item.price} × ${item.qty}</p>
            <button class="remove-cart-btn" data-idx="${idx}" style="padding:4px 8px; border:1px solid #111; background:transparent; cursor:pointer; font-size:11px;">Remove</button>
          </div>
        </div>`;
      });
      cartBody.innerHTML = html;
      document.querySelectorAll(".remove-cart-btn").forEach(btn=>{
        btn.onclick=(e)=>{
          removeFromCart(parseInt(e.target.dataset.idx));
        };
      });
      
      // Update footer with total
      const footer = document.querySelector(".cart-footer");
      const totalDisplay = document.querySelector(".cart-total");
      if(footer && totalDisplay){
        footer.style.display = "block";
        totalDisplay.textContent = "R" + total.toFixed(2);
      }
    }
    
    // Update cart count badge - count total items (including qty)
    const bagIcon = document.querySelector(".bag-icon");
    if(bagIcon){
      let existing = bagIcon.querySelector(".cart-count");
      if(existing) existing.remove();
      
      const totalQty = cartItems.reduce((sum, item) => sum + (item.qty || 1), 0);
      if(totalQty > 0){
        const badge = document.createElement("span");
        badge.className = "cart-count";
        badge.textContent = totalQty;
        badge.style.cssText = "position:absolute; top:-4px; right:-4px; background:#111; color:#fff; width:18px; height:18px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:600;";
        bagIcon.style.position = "relative";
        bagIcon.appendChild(badge);
      }
    }
  }catch(e){
    console.log("Cart display error:", e);
  }
}

// Add to cart with size requirement and quantity aggregation
function addToCart(){
  try{
    const selectedSize = document.querySelector(".size-buttons button.selected");
    
    if(!selectedSize){
      alert("Please select a size first");
      return;
    }
    
    const h1 = document.querySelector(".product-details h1");
    const price = document.querySelector(".product-details .price");
    const mainImage = document.querySelector("#mainProduct");
    const qtyInput = document.querySelector(".qty-input");
    const btn = document.querySelector(".add-cart");
    
    if(!h1 || !price || !mainImage || !btn) return;
    
    const name = h1.textContent.trim();
    const size = selectedSize.textContent.trim();
    const priceText = price.textContent.trim();
    const image = mainImage.currentSrc || mainImage.src;
    const qty = parseInt(qtyInput?.value || 1, 10);
    
    // Check if item with same name and size already exists
    const existingItem = cartItems.find(item => item.name === name && item.size === size);
    
    if(existingItem){
      // Increment quantity
      existingItem.qty = (existingItem.qty || 1) + qty;
    }else{
      // Add new item
      const item = {
        name: name,
        price: priceText,
        size: size,
        image: image,
        qty: qty,
        timestamp: Date.now()
      };
      cartItems.push(item);
    }
    
    saveCart();
    updateCartDisplay();
    
    // Reset quantity selector
    if(qtyInput) qtyInput.value = 1;
    
    // Visual feedback on button
    btn.textContent = "✓ Added";
    btn.style.background = "#111";
    btn.style.color = "#fff";
    
    setTimeout(() => {
      btn.innerHTML = "<span>ADD TO BAG</span>";
      btn.style.background = "";
      btn.style.color = "";
    }, 1500);
  }catch(e){
    console.log("Add to cart error:", e);
  }
}

// Remove from cart
function removeFromCart(idx){
  try{
    cartItems.splice(idx, 1);
    saveCart();
    updateCartDisplay();
  }catch(e){
    console.log("Remove cart error:", e);
  }
}

// Init cart when ready
function initCart(){
  try{
    if(bag && cart && close){
      // Use event listeners (addEventListener) and make bag toggle the cart
      const onBagClick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const isActive = cart.classList.contains("active");
        setCartOpen(!isActive);
      };

      const onCloseClick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setCartOpen(false);
      };

      // Remove any previous listeners to avoid duplicates, then add
      bag.removeEventListener("click", onBagClick);
      bag.addEventListener("click", onBagClick);

      close.removeEventListener("click", onCloseClick);
      close.addEventListener("click", onCloseClick);
    }
    const addCartBtn = document.querySelector(".add-cart");
    if(addCartBtn){
      addCartBtn.onclick = addToCart;
    }
    loadCart();
  }catch(e){
    console.log("Cart init error:", e);
  }
}

// Load cart after page ready
setTimeout(initCart, 100);

// Homepage typewriter intro
/* hero intro removed */

// Quantity selector controls
const qtyMinus = document.querySelector(".qty-minus");
const qtyPlus = document.querySelector(".qty-plus");
const qtyInput = document.querySelector(".qty-input");

if(qtyMinus && qtyInput){
  qtyMinus.onclick = () => {
    const val = Math.max(1, parseInt(qtyInput.value) - 1);
    qtyInput.value = val;
  };
}

if(qtyPlus && qtyInput){
  qtyPlus.onclick = () => {
    const val = Math.min(99, parseInt(qtyInput.value) + 1);
    qtyInput.value = val;
  };
}

// Checkout button - processes payment via Paystack
const checkoutBtn = document.querySelector(".checkout-btn");
if(checkoutBtn){
  checkoutBtn.onclick = () => {
    openEmailModal();
  };
}

// Continue shopping button
const continueBtn = document.querySelector(".continue-shopping-btn");
if(continueBtn){
  continueBtn.onclick = () => {
    setCartOpen(false);
  };
}

const sizes=document.querySelectorAll(".size-buttons button");

sizes.forEach(size=>{

size.onclick=()=>{

const isAlreadySelected = size.classList.contains("selected");

sizes.forEach(btn=>btn.classList.remove("selected"));

// Toggle: if already selected, deselect. Otherwise select it.
if(!isAlreadySelected){

size.classList.add("selected");

}

}

});

const thumbs=document.querySelectorAll(".thumbs img");

const main=document.getElementById("mainProduct");

thumbs.forEach((img,idx)=>{

if(idx===0) img.classList.add("active");

img.onclick=()=>{

thumbs.forEach(t=>t.classList.remove("active"));

img.classList.add("active");

main.src=img.src;

}

});