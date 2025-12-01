import React, { useState } from 'react';
import { Product, ElfPersonality } from '../types';
import { generateProductScript } from '../services/deepseekService';
import { Plus, Wand2, Loader2, Trash2, Edit2, Download, X, Check, AlertCircle } from 'lucide-react';

interface ProductManagerProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  selectedElf: ElfPersonality | null;
}

const ProductManager: React.FC<ProductManagerProps> = ({ products, setProducts, selectedElf }) => {
  const [newProductName, setNewProductName] = useState('');
  const [newProductDesc, setNewProductDesc] = useState('');
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editingScriptId, setEditingScriptId] = useState<string | null>(null);
  const [editScript, setEditScript] = useState<{ intro: string; features: string; objections: string; cta: string; fullText: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAddProduct = () => {
    if (!newProductName.trim()) {
      setError('Product name is required');
      setTimeout(() => setError(null), 3000);
      return;
    }
    const newProduct: Product = {
      id: Date.now().toString(),
      name: newProductName,
      description: newProductDesc,
    };
    setProducts([...products, newProduct]);
    setNewProductName('');
    setNewProductDesc('');
    setError(null);
  };

  const handleStartEdit = (product: Product) => {
    setEditingId(product.id);
    setEditName(product.name);
    setEditDesc(product.description);
  };

  const handleSaveEdit = () => {
    if (!editName.trim()) {
      setError('Product name is required');
      setTimeout(() => setError(null), 3000);
      return;
    }
    setProducts(prev => prev.map(p => 
      p.id === editingId ? { ...p, name: editName, description: editDesc } : p
    ));
    setEditingId(null);
    setEditName('');
    setEditDesc('');
    setError(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditDesc('');
    setError(null);
  };

  const handleExportScript = (product: Product) => {
    if (!product.generatedScript) {
      setError('No script to export');
      setTimeout(() => setError(null), 3000);
      return;
    }
    const content = `Product: ${product.name}\n\n` +
      `INTRO:\n${product.generatedScript.intro}\n\n` +
      `FEATURES:\n${product.generatedScript.features}\n\n` +
      `OBJECTIONS:\n${product.generatedScript.objections}\n\n` +
      `CALL TO ACTION:\n${product.generatedScript.cta}\n\n` +
      `FULL SCRIPT:\n${product.generatedScript.fullText || ''}`;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${product.name.replace(/[^a-z0-9]/gi, '_')}_script.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleGenerateScript = async (productId: string) => {
    if (!selectedElf) {
      setError("Please select an Elf first from the Home tab!");
      setTimeout(() => setError(null), 3000);
      return;
    }
    const product = products.find(p => p.id === productId);
    if (!product) return;

    setIsGenerating(productId);
    setError(null);
    try {
    const script = await generateProductScript(product, selectedElf);
    if (script) {
      setProducts(prev => prev.map(p => 
        p.id === productId ? { ...p, generatedScript: script } : p
      ));
      } else {
        setError('Failed to generate script. Please check your API key in .env.local and try again.');
        setTimeout(() => setError(null), 5000);
      }
    } catch (err: any) {
      const errorMessage = err?.message || 'An error occurred while generating the script. Please try again.';
      setError(errorMessage);
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsGenerating(null);
    }
  };

  const handleDelete = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const handleStartEditScript = (product: Product) => {
    if (!product.generatedScript) return;
    setEditingScriptId(product.id);
    setEditScript({
      intro: product.generatedScript.intro || '',
      features: product.generatedScript.features || '',
      objections: product.generatedScript.objections || '',
      cta: product.generatedScript.cta || '',
      fullText: product.generatedScript.fullText || ''
    });
  };

  const handleSaveScript = (productId: string) => {
    if (!editScript) return;
    setProducts(prev => prev.map(p => 
      p.id === productId ? { 
        ...p, 
        generatedScript: {
          ...editScript,
          fullText: editScript.fullText || `${editScript.intro} ${editScript.features} ${editScript.objections} ${editScript.cta}`
        }
      } : p
    ));
    setEditingScriptId(null);
    setEditScript(null);
  };

  const handleCancelEditScript = () => {
    setEditingScriptId(null);
    setEditScript(null);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto mb-20 md:mb-0">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <span className="text-purple-400">Step 2:</span> Product Scripts
      </h1>

      {/* Error Message */}
      {error && (
        <div className="mb-4 bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Add Product Form */}
      <div className="bg-slate-800 rounded-xl p-6 mb-8 border border-slate-700">
        <h3 className="text-lg font-semibold mb-4 text-white">Add New Product</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Product Name</label>
            <input 
              type="text" 
              value={newProductName}
              onChange={(e) => setNewProductName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-purple-500"
              placeholder="e.g. Galaxy Glow Lamp"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Selling Points / Description</label>
            <textarea 
              value={newProductDesc}
              onChange={(e) => setNewProductDesc(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-purple-500 h-24"
              placeholder="e.g. 16 colors, remote control, USB powered, creates cozy vibe."
            />
          </div>
          <button 
            onClick={handleAddProduct}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                handleAddProduct();
              }
            }}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-4 py-2 rounded-lg transition-all shadow-lg hover:shadow-purple-900/20"
          >
            <Plus size={18} />
            Add to List
          </button>
          <p className="text-xs text-slate-500">Press Ctrl+Enter to quickly add</p>
        </div>
      </div>

      {/* Product List */}
      <div className="space-y-6">
        {products.map(product => (
          <div key={product.id} className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            {/* Responsive Header: Flex Col on mobile, Row on Desktop */}
            <div className="p-4 flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 bg-slate-950/30 gap-4">
              {editingId === product.id ? (
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 text-white focus:outline-none focus:border-purple-500"
                    placeholder="Product Name"
                  />
                  <textarea
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 text-white focus:outline-none focus:border-purple-500 h-20"
                    placeholder="Description"
                  />
                </div>
              ) : (
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-lg truncate">{product.name}</h4>
                <p className="text-sm text-slate-500 truncate">{product.description}</p>
              </div>
              )}
              
              <div className="flex items-center gap-2 w-full md:w-auto">
                {editingId === product.id ? (
                  <>
                    <button 
                      onClick={handleSaveEdit}
                      className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-md text-sm font-medium"
                    >
                      <Check size={16} />
                      Save
                    </button>
                    <button 
                      onClick={handleCancelEdit}
                      className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-md text-sm font-medium"
                    >
                      <X size={16} />
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button 
                      onClick={() => handleStartEdit(product)}
                      className="p-2 text-slate-500 hover:text-blue-400 bg-slate-800 md:bg-transparent rounded-md transition-colors"
                      title="Edit Product"
                    >
                      <Edit2 size={18} />
                    </button>
                    {product.generatedScript && (
                      <button 
                        onClick={() => handleExportScript(product)}
                        className="p-2 text-slate-500 hover:text-green-400 bg-slate-800 md:bg-transparent rounded-md transition-colors"
                        title="Export Script"
                      >
                        <Download size={18} />
                      </button>
                    )}
                <button 
                  onClick={() => handleGenerateScript(product.id)}
                  disabled={!!isGenerating}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:opacity-90 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 whitespace-nowrap"
                >
                  {isGenerating === product.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Wand2 size={16} />
                  )}
                      {product.generatedScript ? "Regenerate" : "Generate"}
                </button>
                <button 
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this product?')) {
                          handleDelete(product.id);
                        }
                      }}
                      className="p-2 text-slate-500 hover:text-red-400 bg-slate-800 md:bg-transparent rounded-md transition-colors"
                      title="Delete Product"
                >
                  <Trash2 size={18} />
                </button>
                  </>
                )}
              </div>
            </div>
            
            {/* Script Preview / Edit */}
            {product.generatedScript && (
              <div className="p-4 space-y-4">
                {editingScriptId === product.id && editScript ? (
                  // Edit Mode
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-semibold text-white">编辑逐字稿</h4>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleSaveScript(product.id)}
                          className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-md text-sm font-medium"
                        >
                          <Check size={16} />
                          保存
                        </button>
                        <button 
                          onClick={handleCancelEditScript}
                          className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-md text-sm font-medium"
                        >
                          <X size={16} />
                          取消
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-purple-400 font-bold text-sm mb-2">Intro（开场）</label>
                        <textarea
                          value={editScript.intro}
                          onChange={(e) => setEditScript({ ...editScript, intro: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white text-sm focus:outline-none focus:border-purple-500 h-32 resize-y"
                          placeholder="开场白..."
                        />
                      </div>
                      <div>
                        <label className="block text-blue-400 font-bold text-sm mb-2">Features（产品特点）</label>
                        <textarea
                          value={editScript.features}
                          onChange={(e) => setEditScript({ ...editScript, features: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white text-sm focus:outline-none focus:border-blue-500 h-32 resize-y"
                          placeholder="产品特点..."
                        />
                      </div>
                      <div>
                        <label className="block text-orange-400 font-bold text-sm mb-2">Objections（处理异议）</label>
                        <textarea
                          value={editScript.objections}
                          onChange={(e) => setEditScript({ ...editScript, objections: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white text-sm focus:outline-none focus:border-orange-500 h-32 resize-y"
                          placeholder="处理异议..."
                        />
                      </div>
                      <div>
                        <label className="block text-green-400 font-bold text-sm mb-2">CTA（行动号召）</label>
                        <textarea
                          value={editScript.cta}
                          onChange={(e) => setEditScript({ ...editScript, cta: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white text-sm focus:outline-none focus:border-green-500 h-32 resize-y"
                          placeholder="行动号召..."
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-slate-300 font-bold text-sm mb-2">Full Text（完整逐字稿）</label>
                      <textarea
                        value={editScript.fullText}
                        onChange={(e) => setEditScript({ ...editScript, fullText: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white text-sm focus:outline-none focus:border-slate-400 h-40 resize-y"
                        placeholder="完整逐字稿（可选，如果不填将自动合并上述内容）..."
                      />
                      <p className="text-xs text-slate-500 mt-1">如果不填写，将自动合并 Intro + Features + Objections + CTA</p>
                    </div>
                  </div>
                ) : (
                  // Preview Mode
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-slate-300">逐字稿预览</h4>
                      <button 
                        onClick={() => handleStartEditScript(product)}
                        className="flex items-center gap-2 text-slate-400 hover:text-blue-400 text-sm transition-colors"
                        title="编辑逐字稿"
                      >
                        <Edit2 size={16} />
                        编辑
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="bg-slate-800/50 p-3 rounded border border-slate-700/50">
                        <span className="text-purple-400 font-bold block mb-1">Intro</span>
                        <p className="text-slate-300 text-xs leading-relaxed whitespace-pre-wrap">{product.generatedScript.intro}</p>
                      </div>
                      <div className="bg-slate-800/50 p-3 rounded border border-slate-700/50">
                        <span className="text-blue-400 font-bold block mb-1">Features</span>
                        <p className="text-slate-300 text-xs leading-relaxed whitespace-pre-wrap">{product.generatedScript.features}</p>
                      </div>
                      <div className="bg-slate-800/50 p-3 rounded border border-slate-700/50">
                        <span className="text-green-400 font-bold block mb-1">CTA</span>
                        <p className="text-slate-300 text-xs leading-relaxed whitespace-pre-wrap">{product.generatedScript.cta}</p>
                      </div>
                    </div>
                    {product.generatedScript.objections && (
                      <div className="bg-slate-800/50 p-3 rounded border border-slate-700/50">
                        <span className="text-orange-400 font-bold block mb-1">Handling Objections</span>
                        <p className="text-slate-300 text-xs leading-relaxed whitespace-pre-wrap">{product.generatedScript.objections}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            {!product.generatedScript && (
              <div className="p-8 text-center text-slate-600 italic">
                No script generated yet. Click the wand button!
              </div>
            )}
          </div>
        ))}
        {products.length === 0 && (
          <div className="text-center py-12 text-slate-600">
            No products added yet. Add one above to get started.
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductManager;