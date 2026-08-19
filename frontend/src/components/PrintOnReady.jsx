import { useEffect } from "react";

/**
 * Opens the print dialog once, and only after every image has finished
 * loading. Printing early is the classic failure here: the dialog renders
 * empty frames where the retina and heatmap should be.
 */
function PrintOnReady({ ready, title }) {
  useEffect(() => {
    if (!ready) {
      return undefined;
    }

    const previous = document.title;

    if (title) {
      // Chrome and Edge use the document title as the default filename in the
      // "Save as PDF" dialog.
      document.title = title;
    }

    let cancelled = false;

    const images = Array.from(document.images);

    const waitFor = images.map((image) =>
      image.complete
        ? Promise.resolve()
        : new Promise((resolve) => {
            image.addEventListener("load", resolve, { once: true });
            image.addEventListener("error", resolve, { once: true });
          })
    );

    Promise.all(waitFor).then(() => {
      if (!cancelled) {
        window.print();
      }
    });

    return () => {
      cancelled = true;
      document.title = previous;
    };
  }, [ready, title]);

  return null;
}

export default PrintOnReady;
