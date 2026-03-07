/* bookshelf-page.js — standalone bookshelf page logic */

const BOOKS_PER_SHELF = 4;

async function init() {
  const container = document.getElementById("bookshelfContainer");
  if (!container) return;

  let data;
  try {
    const res = await fetch("./data/books.json");
    data = await res.json();
  } catch {
    container.innerHTML = '<p class="bs-loading">Could not load books. Please try again later.</p>';
    return;
  }

  const books = data.books || [];
  if (!books.length) {
    container.innerHTML = '<p class="bs-loading">No books yet — check back soon!</p>';
    return;
  }

  container.innerHTML = "";

  // Split books into shelf rows
  const shelves = [];
  for (let i = 0; i < books.length; i += BOOKS_PER_SHELF) {
    shelves.push(books.slice(i, i + BOOKS_PER_SHELF));
  }

  let activeBlurb = null;

  shelves.forEach((shelfBooks, shelfIdx) => {
    // Shelf panel (wood background)
    const shelf = document.createElement("div");
    shelf.className = "bs-shelf";

    // Books row
    const row = document.createElement("div");
    row.className = "bs-books-row";

    shelfBooks.forEach((book) => {
      const bookEl = document.createElement("div");
      bookEl.className = "bs-book" + (!book.url ? " bs-book--coming" : "");

      // Cover wrapper
      const coverWrap = document.createElement("div");
      coverWrap.className = "bs-book__cover-wrap";

      if (book.cover) {
        const img = document.createElement("img");
        img.className = "bs-book__cover";
        img.src = book.cover;
        img.alt = book.title;
        img.loading = "lazy";
        coverWrap.appendChild(img);
      } else {
        const placeholder = document.createElement("span");
        placeholder.className = "bs-book__cover-placeholder";
        placeholder.textContent = "Coming Soon";
        coverWrap.appendChild(placeholder);
      }

      bookEl.appendChild(coverWrap);

      // Title
      const title = document.createElement("div");
      title.className = "bs-book__title";
      title.textContent = book.title;
      bookEl.appendChild(title);

      // Author
      if (book.author) {
        const author = document.createElement("div");
        author.className = "bs-book__author";
        author.textContent = book.author;
        bookEl.appendChild(author);
      }

      // Click handler — show blurb
      if (book.url) {
        bookEl.addEventListener("click", () => {
          showBlurb(book, shelf);
        });
      }

      row.appendChild(bookEl);
    });

    shelf.appendChild(row);

    // Ledge
    const ledge = document.createElement("div");
    ledge.className = "bs-shelf-ledge";

    container.appendChild(shelf);
    container.appendChild(ledge);
  });

  function showBlurb(book, shelfEl) {
    // Remove previous blurb
    if (activeBlurb) {
      activeBlurb.remove();
      // If clicking same book, just close
      if (activeBlurb.dataset.bookTitle === book.title) {
        activeBlurb = null;
        return;
      }
    }

    const blurb = document.createElement("div");
    blurb.className = "bs-blurb";
    blurb.dataset.bookTitle = book.title;

    // Close button
    const closeBtn = document.createElement("button");
    closeBtn.className = "bs-blurb__close";
    closeBtn.innerHTML = "&times;";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      blurb.remove();
      activeBlurb = null;
    });
    blurb.appendChild(closeBtn);

    // Header with thumbnail
    const header = document.createElement("div");
    header.className = "bs-blurb__header";

    if (book.cover) {
      const thumb = document.createElement("img");
      thumb.className = "bs-blurb__thumb";
      thumb.src = book.cover;
      thumb.alt = book.title;
      thumb.loading = "lazy";
      header.appendChild(thumb);
    }

    const titleBlock = document.createElement("div");
    const titleEl = document.createElement("h3");
    titleEl.className = "bs-blurb__title";
    titleEl.textContent = book.title;
    titleBlock.appendChild(titleEl);

    if (book.author) {
      const authorEl = document.createElement("p");
      authorEl.className = "bs-blurb__author";
      authorEl.textContent = "by " + book.author;
      titleBlock.appendChild(authorEl);
    }
    header.appendChild(titleBlock);
    blurb.appendChild(header);

    // Lesson blurb text
    if (book.lessonBlurb) {
      const text = document.createElement("p");
      text.className = "bs-blurb__text";
      text.textContent = book.lessonBlurb;
      blurb.appendChild(text);
    }

    // Link to purchase / view
    if (book.url) {
      const link = document.createElement("a");
      link.className = "bs-blurb__link";
      link.href = book.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "View on Amazon →";
      blurb.appendChild(link);
    }

    // Insert blurb after the shelf's ledge
    const ledge = shelfEl.nextElementSibling;
    if (ledge && ledge.nextSibling) {
      ledge.parentNode.insertBefore(blurb, ledge.nextSibling);
    } else {
      shelfEl.parentNode.appendChild(blurb);
    }

    activeBlurb = blurb;

    // Scroll into view smoothly
    blurb.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

document.addEventListener("DOMContentLoaded", init);
