// Paste this into Chrome DevTools console on a LinkedIn profile page
// Then paste the output back so I can see the actual DOM structure

(function() {
  console.log('=== LINKEDIN DOM DIAGNOSTIC ===\n');

  // Profile page diagnostics
  if (location.href.includes('/in/')) {
    console.log('--- PROFILE PAGE ---');

    // Find all buttons and their parents
    const buttons = document.querySelectorAll('button');
    const messageBtn = Array.from(buttons).find(b => b.textContent?.trim().includes('Message'));
    const moreBtn = Array.from(buttons).find(b => b.textContent?.trim() === 'More');

    if (messageBtn) {
      console.log('Message button found:', messageBtn.outerHTML.substring(0, 200));
      console.log('Parent tag:', messageBtn.parentElement?.tagName);
      console.log('Parent classes:', messageBtn.parentElement?.className);
      console.log('Grandparent tag:', messageBtn.parentElement?.parentElement?.tagName);
      console.log('Grandparent classes:', messageBtn.parentElement?.parentElement?.className);
      console.log('Great-grandparent classes:', messageBtn.parentElement?.parentElement?.parentElement?.className);
    } else {
      console.log('No Message button found!');
    }

    if (moreBtn) {
      console.log('\nMore button found:', moreBtn.outerHTML.substring(0, 200));
      console.log('Same parent as Message?', messageBtn?.parentElement === moreBtn?.parentElement);
    }

    // h1
    const h1 = document.querySelector('h1');
    console.log('\nh1:', h1?.className, '→', h1?.textContent?.trim());
  }

  // Job search diagnostics
  if (location.href.includes('/jobs')) {
    console.log('--- JOB SEARCH PAGE ---');

    // Find job cards
    const listItems = document.querySelectorAll('li');
    let jobCards = Array.from(listItems).filter(li => {
      const link = li.querySelector('a');
      return link?.href?.includes('/jobs/view/');
    });

    console.log('Job card <li> count:', jobCards.length);

    if (jobCards.length > 0) {
      const card = jobCards[0];
      console.log('First card classes:', card.className);
      console.log('First card innerHTML preview:', card.innerHTML.substring(0, 500));

      // Dump class names of all direct children
      Array.from(card.children).forEach((child, i) => {
        console.log(`  child[${i}]:`, child.tagName, child.className?.substring(0, 100));
      });
    }
  }

  console.log('\n=== END DIAGNOSTIC ===');
})();
