/* Fold — huge chapter numeral folio, breaks the uniform "num · rule · headline" rhythm */
import { motion } from "framer-motion";

export default function Fold({ n = "00", label = "" }) {
    return (
        <div className="fold" aria-hidden data-testid={`fold-${n}`}>
            <motion.span
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }}
                className="fold-num font-display"
            >
                {n}
            </motion.span>
            {label && (
                <motion.span
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true, amount: 0.4 }}
                    transition={{ delay: 0.2, duration: 0.6 }}
                    className="fold-label"
                >
                    {label}
                </motion.span>
            )}
        </div>
    );
}
