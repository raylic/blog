---
title: '深入理解React Filber篇 '
description: 介绍fiber结构、DFS算法、Diff过程以及双缓存架构
date: 2026-11-19
tags:
  - 前端
series: 深入理解React
pinned: false
draft: false
---
## Fiber节点、Fiber树

### 结构

![](/uploads/react-filber/%E6%88%AA%E5%B1%8F2026-11-19%2013.13.09.png)

纵向的child链、横向的sblding链，每个节点有一个指向父节点的return指针，构成了整个fiber树。

每个节点拥有三指针：`child`、`sbliding`、`return`

### DFS 算法

对于Fiber的非标准树形结构，DFS的过程也会有所变化，下面代码展示了，Fiber的遍历算法过程，只保留了遍历逻辑。

```js

let workInProgress = root; // cursor 保存当前应该处理节点的指针

// 主循环逻辑
function workLoopSync() {
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }
}

// 光标向下一格，如果是叶子节点、调 completeUnitOfWork
function performUnitOfWork(unitOfWork) {
  let next = unitOfwork.child;
  if (!next) {
    completeUnitOfWork(unitOfWork);
  } else {
    workInProgress = next
  }
}

// 沿着return链，循环向上遍历，直到第一个有兄弟节点的fiber出现，将workInprogress设为这个兄弟节点
function completeUnitOfWork(unitOfWork) {
  let currentUnit = unit;
  do {
    // 执行遍历逻辑省略
    if (currentUnit.sbliding) {
      workInProgress = currentUnit.sbliding;
      return;
    }
    currentUnit = currentUnit.return;
  } while (currentUnit !== null)

}

```

核心是双循环过程、以及模块级变量 `workInProgress`&#x20;

1. &#x20;`workLoopSync` + `performUnitOfWork` 沿child链，找最深的叶子节点，调2
2. &#x20;`compleletUniteOfWork` 从叶子节点沿 `return` 向上遍历，直到当前节点有兄弟节点，停住，把循环交给 1

循环最终在停在`root`，因为 `root.return` 的值是 `null`

### Diff 算法

在看到这个词的时候你可能会认为是 fiber树与 fiber树之间的diff。然而，diff过程只发生在同一个父节点的兄弟节点之间，即 siblding链。

Fiber Diff 算法的本质，是基于旧 siblding链、新的组件数组（JSX），计算出新的sibliding链的过程。

* 目的：尽可能复用已有Fiber、节省性能开销
* 时机：是在DFS过程`completeUnitOfWork`到父节点的时候进行的。
* 对比项：`key`、`Element`，不对比 `props`

过程将diff分成了 **尾部新增**、**删除**，顺序改变（中间插入、中间删除）这两种情况处理 ，其中尾部新增和删除是一种特殊情况，可以高效对比完成，而其余情况为两能复用建MapFiber。

下称对比对象为旧链和新数组

1. 遍历旧链、逐项按照位置对比 key，当前index下的key不同则退出
2. 如果新数组先遍历完，说明旧链**没被遍历到的部分**需要**删除**，对比结束；如果旧链先遍历完，说明新数组**没被遍历到的部分**需要**新增**。遍历完成 return。
3. 如果存在旧链没被遍历到的部分（key不同旧退出循环了）。
   1. 从退出的下标开始 ABCDEF节点的key分别是012345。比如`【A，B，C，D】`和`【A，B，D，E，F】`index是2。基于旧链后缀，建一个 \<key，Fiber> 的Map。

      ```js
      const map = { '2': C，'3', D }
      ```
   2. 遍历新数组剩余部分`【D，E，F】` 、检查是否有相同的key，新数组复用Map中的Fiber，并从Map中去掉。遍历完成得到
      1. 需要新增（数组中有而Map中没有的，E、F）
      2. 删除的节点（Map中剩下的，C）
      3. 可以复用（都有的，D）

## 双缓存架构

![](/uploads/react-filber/%E6%88%AA%E5%B1%8F2026-11-19%2016.04.19.png)

双缓存架构的核心是两个互为备份的Fiber树，我们称为X 和 Y。

current指针指向屏幕上当前显示的Fiber树，在更新过程中，修改current的备份，修改完成之后，current指针指向current.aternate。大致过程如下

1. 第一轮渲染，X树计算完毕、current指针指向X，将X赋值给Y，X的备份指向Y。
2. 第二轮渲染，通过X备份找到Y，修改Y树，Y树如果修改被中断了（比如超时），此时不影响屏幕渲染的内容。如果Y树修改成功，将current指针指向Y，将Y赋值给X，Y的备份指向X。
3. 循环以上过程

## 可中断、可恢复的底层原理

fiber架构在React 16中出现，和前版本最大的区别就是虚拟dom树遍历的可中断、可恢复。

实现原理是第一节的DFS算法的while遍历，案例中主循环逻辑是其中一种，可中断的循环逻辑如下。

```js
// 主循环逻辑，上文同款
function workLoopSync() {
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }
}

// 可中断的循环逻辑
function workLoop() {
  while (workInProgress !== null && !shouldYeild()) {
    performUnitOfWork(workInProgress);
  }
}
```

传统递归遍历DFS过程中，遍历到了哪个节点、渲染执行到了哪一步全部在JS引擎内部，对编程不可见。

while循环提供了两件事

* 可中断性，暂停只需要修改while循环条件。
* 可恢复性，`workInProgress`可、`WIP树`等模块及变量在中断后可保存。下次再进入循环直接调用`workLoop`可续跑。
